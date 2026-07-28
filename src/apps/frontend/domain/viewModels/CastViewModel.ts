// Chromecast contra el receptor propio de Jellyfin. A diferencia del Default
// Media Receiver, el receptor de Jellyfin habla con el servidor por su cuenta:
// le mandamos credenciales + el id del item y él resuelve PlaybackInfo,
// transcode y subtítulos. Por eso funciona con contenido que aquí exigiría
// HLS/MSE, donde la Remote Playback API del navegador no puede hacer nada.
//
// El id de la app receptora sale de la configuración del usuario
// (CastReceiverId), igual que en el cliente oficial.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';

import { apiService, type ApiService } from '../../data/api/ApiService';
import {
    JELLYFIN_CAST_NAMESPACE, loadCastSender, type CastSession
} from '../../data/cast/castSender';

export type CastState = 'unavailable' | 'disconnected' | 'connecting' | 'connected';

/** Comandos del protocolo del receptor que usamos. */
type CastCommand = 'PlayNow' | 'Unpause' | 'Pause' | 'Stop' | 'Seek';

export class CastViewModel {
    /** Hay al menos un receptor Cast alcanzable en la red. */
    available = signal(false);
    state = signal<CastState>('unavailable');
    /** Nombre del receptor conectado, para el OSD. */
    deviceName = signal<string | null>(null);
    error = signal<string | null>(null);

    private session: CastSession | null = null;
    private initialized = false;

    constructor(private api: ApiService) {}

    /**
     * Carga el SDK e inicializa la sesión Cast. Idempotente y silencioso: si
     * no hay soporte, el usuario simplemente no ve el botón.
     */
    async init(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        const cast = await loadCastSender();
        if (!cast) return;

        const receiverId = await this.receiverId();
        if (!receiverId) {
            // Sin receptor configurado no hay nada que lanzar. El servidor
            // trae uno por defecto, así que esto solo pasa si lo han vaciado.
            console.warn('[cast] el usuario no tiene CastReceiverId configurado');
            return;
        }

        const config = new cast.ApiConfig(
            new cast.SessionRequest(receiverId),
            // Auto-join: si ya había una sesión (recarga de página), se reengancha.
            (session) => this.adoptSession(session),
            (availability) => {
                this.available.value = availability === cast.ReceiverAvailability.AVAILABLE;
                if (this.state.value === 'unavailable' && this.available.value) {
                    this.state.value = 'disconnected';
                }
            }
        );

        await new Promise<void>((resolve) => {
            cast.initialize(config, () => resolve(), (err) => {
                console.warn('[cast] initialize falló', err);
                resolve();
            });
        });
    }

    /** Abre el selector de dispositivos del navegador. */
    prompt = async (): Promise<void> => {
        const cast = await loadCastSender();
        if (!cast) return;
        this.state.value = 'connecting';
        this.error.value = null;
        cast.requestSession(
            (session) => this.adoptSession(session),
            (err) => {
                // El usuario cerrando el diálogo también llega por aquí.
                this.state.value = this.available.value ? 'disconnected' : 'unavailable';
                console.debug('[cast] requestSession cancelado o fallido', err);
            }
        );
    };

    /** Manda el item al receptor. Requiere una sesión activa. */
    async playItem(itemId: string, startTicks = 0): Promise<void> {
        await this.send('PlayNow', {
            items: [{ Id: itemId }],
            startPositionTicks: startTicks
        });
    }

    pause = () => this.send('Pause');
    unpause = () => this.send('Unpause');
    seek = (positionTicks: number) => this.send('Seek', undefined, { positionTicks });

    /** Cierra la sesión y devuelve la reproducción a este navegador. */
    stopCasting = async (): Promise<void> => {
        const session = this.session;
        if (!session) return;
        await new Promise<void>((resolve) => {
            session.stop(() => resolve(), () => resolve());
        });
        this.clearSession();
    };

    private adoptSession(session: CastSession) {
        this.session = session;
        this.state.value = 'connected';
        this.deviceName.value = session.receiver?.friendlyName ?? null;
        session.addUpdateListener((isAlive) => {
            if (!isAlive) this.clearSession();
        });
        session.addMessageListener(JELLYFIN_CAST_NAMESPACE, (_ns, raw) => {
            this.onReceiverMessage(raw);
        });
    }

    private onReceiverMessage(raw: string) {
        try {
            const message = JSON.parse(raw) as { type?: string };
            // El receptor avisa de errores de reproducción y de conexión; el
            // resto de mensajes son estado que aquí no pintamos.
            if (message.type === 'playbackerror' || message.type === 'connectionerror') {
                this.error.value = message.type;
            }
        } catch {
            // Mensaje no-JSON del receptor: ignorable.
        }
    }

    private clearSession() {
        this.session = null;
        this.deviceName.value = null;
        this.state.value = this.available.value ? 'disconnected' : 'unavailable';
    }

    /**
     * Envía un comando por el canal de Jellyfin. El receptor necesita las
     * credenciales en CADA mensaje: no guarda sesión propia.
     */
    private async send(
        command: CastCommand,
        options?: Record<string, unknown>,
        extra?: Record<string, unknown>
    ): Promise<void> {
        const session = this.session;
        if (!session) throw new Error('cast: no session');

        const auth = this.api.session.load();
        if (!auth?.accessToken || !auth.userId) throw new Error('cast: no auth');

        const message = {
            command,
            options,
            userId: auth.userId,
            accessToken: auth.accessToken,
            // localhost no es alcanzable desde el Chromecast: es la trampa
            // clásica de esta integración y conviene avisar en consola.
            serverAddress: auth.serverUrl,
            serverId: auth.serverId,
            deviceId: this.api.playback.getDeviceId(),
            receiverName: session.receiver?.friendlyName ?? null,
            maxBitrate: this.api.playback.getMaxStreamingBitrate(),
            ...extra
        };

        if (isLoopback(auth.serverUrl)) {
            console.warn('[cast] serverAddress es localhost: el receptor no podrá alcanzar el servidor');
        }

        await new Promise<void>((resolve, reject) => {
            session.sendMessage(
                JELLYFIN_CAST_NAMESPACE,
                message,
                () => resolve(),
                (err) => reject(err instanceof Error ? err : new Error(String(err)))
            );
        });
    }

    private async receiverId(): Promise<string | null> {
        try {
            const user = await this.api.users.getCurrentUser();
            const id = user.config.CastReceiverId;
            return typeof id === 'string' && id ? id : null;
        } catch {
            return null;
        }
    }
}

function isLoopback(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return hostname === 'localhost' || hostname.startsWith('127.') || hostname === '[::1]';
    } catch {
        return false;
    }
}

export const castVM = new CastViewModel(apiService);
