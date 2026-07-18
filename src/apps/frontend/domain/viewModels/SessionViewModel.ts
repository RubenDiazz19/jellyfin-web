// ViewModel de sesión: expone la sesión activa como signal y los comandos
// login/logout. Sustituye al antiguo SessionProvider de React.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService, type Session } from '../../data/api/ApiService';

export class SessionViewModel {
    session = signal<Session | null>(null);

    private started = false;
    private hydrated = false;

    constructor(private api: ApiService) {}

    /**
     * Lee la sesión actual de ServerConnections. Idempotente; se llama en el
     * primer render para evitar el flash de LoginPage al recargar autenticado
     * (en el eval del módulo ServerConnections aún no tiene ApiClient).
     */
    hydrate() {
        if (this.hydrated) return;
        this.hydrated = true;
        this.refresh();
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
