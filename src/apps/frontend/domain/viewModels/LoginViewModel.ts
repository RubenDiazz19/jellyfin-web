// ViewModel del login en dos pasos (servidor → credenciales).
//
// Del segundo paso salen dos caminos: usuario y contraseña, o Quick Connect —un
// código que se aprueba desde una sesión ya abierta, sin teclear la contraseña
// aquí—. Los dos acaban igual, con `notifyChanged()`, porque la sesión que
// producen es la misma.
//
// La View pinta los signals y muestra el resultado como toast; este VM no sabe
// nada de React ni de presentation/.

import globalize from 'lib/globalize';

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';

const SERVER_URL_KEY = 'jfp-server-url';

export type LoginStep = 'server' | 'login';
export type LoginResult = { ok: boolean; message: string };

export class LoginViewModel {
    step = signal<LoginStep>('server');
    serverUrl = signal('');
    username = signal('');
    password = signal('');
    busy = signal(false);

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
            this.step.value = 'login';
        }
    }

    setServerUrl = (v: string) => { this.serverUrl.value = v; };
    setUsername = (v: string) => { this.username.value = v; };
    setPassword = (v: string) => { this.password.value = v; };

    backToServer = () => {
        // Un código pedido al servidor anterior no vale para el siguiente.
        this.cancelQuickConnect();
        this.quickConnectAvailable.value = false;
        this.quickConnectCheckedFor = '';
        this.step.value = 'server';
    };

    /** Paso 1: normaliza y guarda la URL del servidor. */
    chooseServer = (): boolean => {
        const normalized = this.api.auth.normalizeServerUrl(this.serverUrl.value);
        if (!normalized) return false;
        this.serverUrl.value = normalized;
        localStorage.setItem(SERVER_URL_KEY, normalized);
        this.step.value = 'login';
        return true;
    };

    /**
     * Paso 2: autentica contra el servidor. En caso de éxito la sesión global
     * cambia y la app abandona el login, así que `busy` se queda activo.
     */
    submitLogin = async (): Promise<LoginResult> => {
        const user = this.username.value.trim();
        if (!user || !this.password.value) {
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
