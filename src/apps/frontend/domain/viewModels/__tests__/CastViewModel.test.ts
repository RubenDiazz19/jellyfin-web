// Chromecast contra el receptor de Jellyfin: init, sesión y protocolo de
// mensajes. El SDK de Google se mockea entero — es un script externo.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiService } from '../../../data/api/ApiService';
import { JELLYFIN_CAST_NAMESPACE } from '../../../data/cast/castSender';
import { CastViewModel } from '../CastViewModel';

const loadCastSender = vi.hoisted(() => vi.fn());
vi.mock('../../../data/cast/castSender', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../data/cast/castSender')>()),
    loadCastSender
}));
vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const RECEIVER_ID = 'F007D354';

type Listener = (isAlive: boolean) => void;

function fakeSession(name = 'Salón') {
    const messages: unknown[] = [];
    let updateListener: Listener | null = null;
    let messageListener: ((ns: string, raw: string) => void) | null = null;
    return {
        messages,
        emitUpdate: (alive: boolean) => updateListener?.(alive),
        emitMessage: (raw: string) => messageListener?.(JELLYFIN_CAST_NAMESPACE, raw),
        session: {
            sessionId: 's1',
            receiver: { friendlyName: name },
            addUpdateListener: (l: Listener) => { updateListener = l; },
            addMessageListener: (_ns: string, l: (ns: string, raw: string) => void) => { messageListener = l; },
            sendMessage: (_ns: string, msg: unknown, ok: () => void) => { messages.push(msg); ok(); },
            stop: (ok: () => void) => ok()
        }
    };
}

/** SDK falso: captura los listeners que le pasa el ViewModel. */
function fakeCast() {
    const captured: {
        sessionListener?: (s: unknown) => void;
        receiverListener?: (a: string) => void;
        appId?: string;
    } = {};
    let requested: unknown = null;
    return {
        captured,
        setRequested: (s: unknown) => { requested = s; },
        api: {
            isAvailable: true,
            ReceiverAvailability: { AVAILABLE: 'available' },
            SessionRequest: class {
                constructor(appId: string) { captured.appId = appId; }
            },
            ApiConfig: class {
                constructor(
                    _req: unknown,
                    sessionListener: (s: unknown) => void,
                    receiverListener: (a: string) => void
                ) {
                    captured.sessionListener = sessionListener;
                    captured.receiverListener = receiverListener;
                }
            },
            initialize: (_c: unknown, ok: () => void) => ok(),
            requestSession: (ok: (s: unknown) => void, err: (e: unknown) => void) => {
                if (requested) ok(requested);
                else err(new Error('cancelled'));
            }
        }
    };
}

function mockApi(overrides: { castReceiverId?: unknown; serverUrl?: string } = {}): ApiService {
    return {
        session: {
            load: () => ({
                serverUrl: overrides.serverUrl ?? 'http://media.local:8096',
                accessToken: 'tok',
                userId: 'u1',
                serverId: 'srv1'
            })
        },
        users: {
            getCurrentUser: () => Promise.resolve({
                config: { CastReceiverId: 'castReceiverId' in overrides ? overrides.castReceiverId : RECEIVER_ID }
            })
        },
        playback: {
            getDeviceId: () => 'dev1',
            getMaxStreamingBitrate: () => 20_000_000
        }
    } as unknown as ApiService;
}

describe('CastViewModel', () => {
    beforeEach(() => {
        loadCastSender.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('sin SDK disponible se queda en unavailable y no revienta', async () => {
        loadCastSender.mockResolvedValue(null);
        const vm = new CastViewModel(mockApi());

        await vm.init();

        expect(vm.state.value).toBe('unavailable');
        expect(vm.available.value).toBe(false);
    });

    test('init usa el CastReceiverId del usuario', async () => {
        const cast = fakeCast();
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());

        await vm.init();

        expect(cast.captured.appId).toBe(RECEIVER_ID);
    });

    test('sin CastReceiverId no inicializa el SDK', async () => {
        const cast = fakeCast();
        loadCastSender.mockResolvedValue(cast.api);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const vm = new CastViewModel(mockApi({ castReceiverId: '' }));

        await vm.init();

        expect(cast.captured.appId).toBeUndefined();
        expect(vm.state.value).toBe('unavailable');
    });

    test('el receiverListener marca disponibilidad', async () => {
        const cast = fakeCast();
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());
        await vm.init();

        cast.captured.receiverListener?.('available');
        expect(vm.available.value).toBe(true);
        expect(vm.state.value).toBe('disconnected');

        cast.captured.receiverListener?.('unavailable');
        expect(vm.available.value).toBe(false);
    });

    test('init es idempotente', async () => {
        const cast = fakeCast();
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());

        await vm.init();
        await vm.init();

        expect(loadCastSender).toHaveBeenCalledTimes(1);
    });

    test('una sesión previa se readopta (auto-join tras recargar)', async () => {
        const cast = fakeCast();
        const fake = fakeSession('Cocina');
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());
        await vm.init();

        cast.captured.sessionListener?.(fake.session);

        expect(vm.state.value).toBe('connected');
        expect(vm.deviceName.value).toBe('Cocina');
    });

    test('prompt cancelado vuelve al estado anterior', async () => {
        const cast = fakeCast();
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());
        await vm.init();
        cast.captured.receiverListener?.('available');

        await vm.prompt();

        expect(vm.state.value).toBe('disconnected');
    });

    test('playItem manda PlayNow con credenciales por el canal de Jellyfin', async () => {
        const cast = fakeCast();
        const fake = fakeSession();
        cast.setRequested(fake.session);
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());
        await vm.init();
        await vm.prompt();

        await vm.playItem('item42', 300_000_000);

        expect(vm.state.value).toBe('connected');
        expect(fake.messages).toHaveLength(1);
        expect(fake.messages[0]).toMatchObject({
            command: 'PlayNow',
            options: { items: [{ Id: 'item42' }], startPositionTicks: 300_000_000 },
            userId: 'u1',
            accessToken: 'tok',
            serverAddress: 'http://media.local:8096',
            deviceId: 'dev1',
            maxBitrate: 20_000_000,
            receiverName: 'Salón'
        });
    });

    test('playItem sin sesión falla explícitamente', async () => {
        const cast = fakeCast();
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());
        await vm.init();

        await expect(vm.playItem('item42')).rejects.toThrow('no session');
    });

    test('avisa si el servidor es localhost (inalcanzable para el receptor)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const cast = fakeCast();
        const fake = fakeSession();
        cast.setRequested(fake.session);
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi({ serverUrl: 'http://localhost:8096' }));
        await vm.init();
        await vm.prompt();

        await vm.playItem('item42');

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('localhost'));
    });

    test('si el receptor muere se vuelve a disconnected', async () => {
        const cast = fakeCast();
        const fake = fakeSession();
        cast.setRequested(fake.session);
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());
        await vm.init();
        cast.captured.receiverListener?.('available');
        await vm.prompt();
        expect(vm.state.value).toBe('connected');

        fake.emitUpdate(false);

        expect(vm.state.value).toBe('disconnected');
        expect(vm.deviceName.value).toBeNull();
    });

    test('stopCasting cierra la sesión', async () => {
        const cast = fakeCast();
        const fake = fakeSession();
        cast.setRequested(fake.session);
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());
        await vm.init();
        await vm.prompt();

        await vm.stopCasting();

        expect(vm.state.value).toBe('unavailable');
        expect(vm.deviceName.value).toBeNull();
    });

    test('un error del receptor llega al signal de error', async () => {
        const cast = fakeCast();
        const fake = fakeSession();
        cast.setRequested(fake.session);
        loadCastSender.mockResolvedValue(cast.api);
        const vm = new CastViewModel(mockApi());
        await vm.init();
        await vm.prompt();

        fake.emitMessage(JSON.stringify({ type: 'playbackerror', data: 3 }));
        expect(vm.error.value).toBe('playbackerror');

        // Un mensaje no-JSON no debe romper nada.
        fake.emitMessage('no soy json');
        expect(vm.error.value).toBe('playbackerror');
    });
});
