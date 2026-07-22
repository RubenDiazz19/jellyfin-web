// ViewModel de sesión: expone la sesión activa como signal y los comandos
// login/logout. Sustituye al antiguo SessionProvider de React.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService, type Session } from '../../data/api/ApiService';

export class SessionViewModel {
    session = signal<Session | null>(null);
    // true mientras se está restaurando la sesión desde storage; la vista
    // Root usa esto para no pintar LoginPage un frame antes del auto-login.
    hydrating = signal(true);

    private started = false;
    private hydrated = false;

    constructor(private api: ApiService) {}

    /**
     * Restaura la sesión guardada (localStorage) llamando al connect() del
     * ConnectionManager, que valida el AccessToken y hace setAuthenticationInfo
     * en el ApiClient. Idempotente. La primera lectura sincrónica sirve para
     * dejar la sesión disponible cuanto antes si el ApiClient ya tenía token
     * (p. ej. tras un login en la misma pestaña).
     */
    hydrate() {
        if (this.hydrated) return;
        this.hydrated = true;
        this.refresh();
        void this.api.session.restore().then((session) => {
            this.session.value = session ?? this.api.session.load();
            this.hydrating.value = false;
        });
    }

    /** Engancha los eventos de cambio de sesión. Devuelve el cleanup. */
    start(): () => void {
        this.refresh();
        if (this.started || typeof window === 'undefined') return () => {};
        this.started = true;
        this.api.session.wireServerConnectionsEvents();
        window.addEventListener(this.api.session.changeEvent, this.refresh);
        return () => {
            window.removeEventListener(this.api.session.changeEvent, this.refresh);
            this.started = false;
        };
    }

    refresh = () => {
        this.session.value = this.api.session.load();
    };

    logout = () => {
        this.api.catalog.clearShowCache();
        this.api.session.clear();
    };
}

export const sessionVM = new SessionViewModel(apiService);
