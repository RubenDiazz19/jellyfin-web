// ViewModel del login en pasos:
// 1. Selección de servidor disponible / añadir servidor.
// 2. Selección de perfil de usuario (estilo Netflix/Jellyfin) o login manual.
// 3. Introducción de contraseña (si el usuario la requiere) o Quick Connect.
//
// La View pinta los signals y muestra el resultado como toast; este VM no sabe
// nada de React ni de presentation/.

import globalize from 'lib/globalize';

import { signal } from '@preact/signals-core';
import { apiService, type ApiService, type DiscoveredServer, type PublicUser } from '../../data/api/ApiService';

const SERVER_URL_KEY = 'jfp-server-url';

export type LoginStep = 'server' | 'users' | 'password' | 'manual' | 'login';
export type LoginResult = { ok: boolean; message: string };
export type { DiscoveredServer, PublicUser };

export class LoginViewModel {
    step = signal<LoginStep>('server');
    serverUrl = signal('');
    serverName = signal('');
    username = signal('');
    password = signal('');
    busy = signal(false);

    /** Lista de servidores detectados / guardados y su estado */
    servers = signal<DiscoveredServer[]>([]);
    checkingServers = signal(false);

    /** Lista de usuarios públicos del servidor seleccionado */
    publicUsers = signal<PublicUser[]>([]);
    loadingUsers = signal(false);
    selectedUser = signal<PublicUser | null>(null);

    /** Si el servidor tiene Quick Connect habilitado: sin esto no se ofrece. */
    quickConnectAvailable = signal(false);
    /** El código que hay que aprobar, mientras se espera; null si no hay espera. */
    quickConnectCode = signal<string | null>(null);

    /** Corta la espera del código al cancelar o al cambiar de servidor. */
    private quickConnectAbort: AbortController | null = null;
    /** Último servidor al que se le preguntó por Quick Connect. */
    private quickConnectCheckedFor = '';

    constructor(private api: ApiService) {
        const saved = typeof localStorage !== 'undefined' ?
            localStorage.getItem(SERVER_URL_KEY) :
            null;
        if (saved) {
            this.serverUrl.value = saved;
            this.step.value = 'users';
        } else {
            this.step.value = 'server';
        }
        if (this.api.auth.getSavedServers) {
            this.servers.value = this.api.auth.getSavedServers();
        }
    }

    /**
     * Inicializa comprobaciones asíncronas de servidores y usuarios fuera del constructor.
     */
    init = () => {
        if (this.step.value === 'users' && this.serverUrl.value) {
            void this.loadPublicUsers(this.serverUrl.value);
        }
        void this.loadServers();
    };

    setServerUrl = (v: string) => { this.serverUrl.value = v; };
    setUsername = (v: string) => { this.username.value = v; };
    setPassword = (v: string) => { this.password.value = v; };

    /**
     * Carga los servidores guardados y comprueba en paralelo si están en línea.
     * Actualiza la signal conforme cada servidor responde para que los
     * disponibles aparezcan sin esperar a los que tardan en fallar por timeout.
     */
    loadServers = async () => {
        const list = this.api.auth.getSavedServers ? this.api.auth.getSavedServers() : [];
        if (list.length === 0) {
            this.servers.value = [];
            this.checkingServers.value = false;
            return;
        }

        this.checkingServers.value = true;
        const currentServers: DiscoveredServer[] = [...list];

        const updateServers = () => {
            const uniqueServers: DiscoveredServer[] = [];
            const seenIds = new Set<string>();
            for (const s of currentServers) {
                if (s.id && seenIds.has(s.id)) continue;
                if (s.id) seenIds.add(s.id);
                uniqueServers.push(s);
            }
            this.servers.value = uniqueServers;
        };

        try {
            await Promise.all(
                list.map(async (srv, index) => {
                    if (!this.api.auth.validateServer) {
                        currentServers[index] = { ...srv, online: true };
                        updateServers();
                        return;
                    }
                    const res = await this.api.auth.validateServer(srv.url);
                    currentServers[index] = {
                        ...srv,
                        id: res.id || srv.id,
                        name: res.ok && res.name ? res.name : srv.name,
                        version: res.version,
                        online: res.ok
                    };
                    updateServers();
                })
            );
        } finally {
            this.checkingServers.value = false;
        }
    };

    /**
     * Vuelve a la pantalla de selección de servidores.
     */
    backToServer = () => {
        this.cancelQuickConnect();
        this.quickConnectAvailable.value = false;
        this.quickConnectCheckedFor = '';
        this.selectedUser.value = null;
        this.password.value = '';
        this.step.value = 'server';
        void this.loadServers();
    };

    /**
     * Vuelve de la pantalla de contraseña o manual a la selección de usuarios.
     */
    backToUsers = () => {
        this.cancelQuickConnect();
        this.selectedUser.value = null;
        this.password.value = '';
        if (this.publicUsers.value.length > 0) {
            this.step.value = 'users';
        } else {
            this.step.value = 'server';
        }
    };

    /**
     * Cambia a la vista de introducción manual de credenciales.
     */
    goToManualLogin = () => {
        this.cancelQuickConnect();
        this.selectedUser.value = null;
        this.username.value = '';
        this.password.value = '';
        this.step.value = 'manual';
    };

    /**
     * Selecciona un servidor de la lista o valida uno nuevo y pasa a usuarios.
     */
    selectServer = async (server: DiscoveredServer): Promise<LoginResult> => {
        const normalized = this.api.auth.normalizeServerUrl(server.url);
        if (!normalized) {
            return { ok: false, message: globalize.translate('MessageInvalidServer') };
        }

        this.busy.value = true;
        try {
            if (this.api.auth.validateServer) {
                const validation = await this.api.auth.validateServer(normalized);
                if (!validation.ok) {
                    this.busy.value = false;
                    return { ok: false, message: validation.error || globalize.translate('MessageInvalidServer') };
                }
                if (validation.name) {
                    server.name = validation.name;
                }
            }

            this.serverUrl.value = normalized;
            this.serverName.value = server.name || normalized;

            if (this.api.auth.saveServer) {
                this.api.auth.saveServer({ ...server, url: normalized, online: true });
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(SERVER_URL_KEY, normalized);
            }

            await this.loadPublicUsers(normalized);

            if (this.publicUsers.value.length > 0) {
                this.step.value = 'users';
            } else {
                this.step.value = 'login';
            }
            this.busy.value = false;
            return { ok: true, message: '' };
        } catch (err) {
            this.busy.value = false;
            return {
                ok: false,
                message: (err as Error).message || globalize.translate('MessageInvalidServer')
            };
        }
    };

    /** Paso 1: normaliza y guarda la URL del servidor (compatibilidad con tests y form). */
    chooseServer = (): boolean => {
        const normalized = this.api.auth.normalizeServerUrl(this.serverUrl.value);
        if (!normalized) return false;
        this.serverUrl.value = normalized;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SERVER_URL_KEY, normalized);
        }
        if (this.api.auth.saveServer) {
            this.api.auth.saveServer({ name: normalized, url: normalized });
        }
        void this.loadPublicUsers(normalized).then(() => {
            if (this.publicUsers.value.length > 0) {
                this.step.value = 'users';
            } else {
                this.step.value = 'login';
            }
        });
        return true;
    };

    /** Elimina un servidor guardado. */
    removeServer = (url: string) => {
        if (this.api.auth.removeSavedServer) {
            this.api.auth.removeSavedServer(url);
        }
        void this.loadServers();
    };

    /**
     * Carga los perfiles públicos de un servidor para la pantalla tipo Netflix.
     */
    loadPublicUsers = async (url: string) => {
        this.loadingUsers.value = true;
        try {
            const users = this.api.auth.getPublicUsers ?
                await this.api.auth.getPublicUsers(url) :
                [];
            this.publicUsers.value = users;
        } catch {
            this.publicUsers.value = [];
        } finally {
            this.loadingUsers.value = false;
        }
    };

    /**
     * Selecciona un perfil de usuario. Si no tiene contraseña configurada,
     * inicia sesión directamente. Si tiene, pide la contraseña.
     */
    selectUser = async (user: PublicUser): Promise<LoginResult | null> => {
        this.selectedUser.value = user;
        this.username.value = user.name;
        this.password.value = '';

        if (!user.hasPassword) {
            // Usuario sin contraseña: entra directamente sin pedir nada
            return this.submitLogin();
        }

        // Requiere contraseña: pasa al formulario de contraseña para este usuario
        this.step.value = 'password';
        return null;
    };

    /**
     * Devuelve la URL del avatar de un usuario público.
     */
    getUserAvatarUrl = (user: PublicUser): string => {
        if (this.api.auth.avatarUrlForUser) {
            return this.api.auth.avatarUrlForUser(this.serverUrl.value, user.id, user.primaryImageTag);
        }
        return '';
    };

    /**
     * Paso 2: autentica contra el servidor. En caso de éxito la sesión global
     * cambia y la app abandona el login, así que `busy` se queda activo.
     */
    submitLogin = async (): Promise<LoginResult> => {
        const user = this.username.value.trim();
        if (!user) {
            return { ok: false, message: globalize.translate('MessageMissingCredentials') };
        }
        this.busy.value = true;
        try {
            const auth = await this.api.auth.authenticate(
                this.serverUrl.value.trim(), user, this.password.value
            );
            this.api.session.notifyChanged();
            return { ok: true, message: globalize.translate('MessageSignedInAs', auth.displayName) };
        } catch (err) {
            this.busy.value = false;
            return { ok: false, message: (err as Error).message || globalize.translate('MessageSignInFailed') };
        }
    };

    /**
     * Pregunta si este servidor ofrece Quick Connect. Se llama al entrar en el
     * paso de credenciales y no en `chooseServer`, porque con una URL guardada
     * se entra ahí directamente sin pasar por el primer paso. Una vez por
     * servidor: la respuesta no cambia mientras se mira la misma pantalla.
     */
    checkQuickConnect = async () => {
        const url = this.serverUrl.value.trim();
        if (!url || this.quickConnectCheckedFor === url) return;
        this.quickConnectCheckedFor = url;
        this.quickConnectAvailable.value = await this.api.auth.isQuickConnectEnabled(url);
    };

    /**
     * Pide un código y espera a que lo aprueben. Devuelve null si se cancela
     * —no hay nada que contarle al usuario, ha sido él— y el resultado en
     * cualquier otro caso. En caso de éxito la sesión global cambia y la app
     * abandona el login, así que `busy` se queda activo.
     */
    startQuickConnect = async (): Promise<LoginResult | null> => {
        const url = this.serverUrl.value.trim();
        if (!url) return null;

        this.cancelQuickConnect();
        const abort = new AbortController();
        this.quickConnectAbort = abort;
        this.busy.value = true;

        try {
            const { code, secret } = await this.api.auth.startQuickConnect(url);
            if (abort.signal.aborted) return null;
            this.quickConnectCode.value = code;

            const approved = await this.api.auth.waitForQuickConnect(url, secret, abort.signal);
            if (abort.signal.aborted) return null;
            if (!approved) {
                this.resetQuickConnect();
                return { ok: false, message: globalize.translate('MessageQuickConnectExpired') };
            }

            const auth = await this.api.auth.authenticateWithQuickConnect(url, secret);
            this.api.session.notifyChanged();
            return { ok: true, message: globalize.translate('MessageSignedInAs', auth.displayName) };
        } catch (err) {
            if (abort.signal.aborted) return null;
            this.resetQuickConnect();
            return {
                ok: false,
                message: (err as Error).message || globalize.translate('MessageQuickConnectFailed')
            };
        }
    };

    /** Deja de esperar el código y vuelve al formulario. */
    cancelQuickConnect = () => {
        this.quickConnectAbort?.abort();
        this.quickConnectAbort = null;
        this.resetQuickConnect();
    };

    private resetQuickConnect() {
        this.quickConnectCode.value = null;
        this.busy.value = false;
    }
}

export const loginVM = new LoginViewModel(apiService);
