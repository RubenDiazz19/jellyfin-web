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
            this.adopt(session ?? this.api.session.load());
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
        this.adopt(this.api.session.load());
    };

    /**
     * Deja `session` como la activa y, si es una cuenta distinta de la que
     * había, baja sus favoritos del servidor.
     *
     * El corazón de cada tarjeta lo pinta el store local, así que sin esta
     * hidratación un navegador recién estrenado los enseñaría todos vacíos y
     * uno que cambia de cuenta enseñaría los del usuario anterior. Si el
     * servidor no contesta se ignora: el store se queda como estaba, que es
     * mejor que vaciarlo.
     */
    private adopt(session: Session | null) {
        const otherUser = session?.userId !== this.session.peek()?.userId;
        this.session.value = session;
        if (session?.accessToken && otherUser) {
            void this.api.items.hydrateFavorites().catch(() => {});
        }
    }

    logout = () => {
        this.api.catalog.clearShowCache();
        // Los listados también: van cacheados por usuario, pero al volver a
        // entrar la misma cuenta encontraría su biblioteca de antes de salir.
        this.api.catalog.invalidateLists();
        this.api.session.clear();
    };
}

export const sessionVM = new SessionViewModel(apiService);
