// ViewModel del login en dos pasos (servidor → credenciales).
// La View pinta los signals y muestra el resultado de submitLogin() como
// toast; este VM no sabe nada de React ni de presentation/.

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
    backToServer = () => { this.step.value = 'server'; };

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
}

export const loginVM = new LoginViewModel(apiService);
