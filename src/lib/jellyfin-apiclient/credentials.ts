// Persistencia de los servidores conocidos y de sus tokens.
//
// Sustituye a la clase `Credentials` del paquete `jellyfin-apiclient`, que es
// una de las tres últimas cosas que nos atan a él. Se conservan LA CLAVE DE
// ALMACENAMIENTO y LA FORMA DEL OBJETO: cambiar cualquiera de las dos
// desconectaría a todo el mundo al desplegar, porque las sesiones vivas se leen
// justo de ahí.
//
// Tres diferencias deliberadas con el original:
//
//   1. No se escribe el JSON de credenciales en la consola. El original hacía
//      `console.log` de él en cada arranque, tokens de acceso incluidos.
//   2. No se duplica en un `Cache` de CacheStorage. El original escribía una
//      copia en la caché `embydata` que nadie leía nunca — su propio `getItem`
//      lee solo de localStorage.
//   3. Un almacenamiento corrupto no impide arrancar. El original hacía
//      `JSON.parse` sin proteger, así que un valor ilegible dejaba la app
//      muerta sin forma de recuperarse salvo borrando el sitio a mano.

import Events from 'utils/events';

/** Clave heredada. No se toca: es donde están las sesiones ya guardadas. */
const STORAGE_KEY = 'jellyfin_credentials';

/** Servidor conocido, tal cual se guarda. */
export interface ServerCredentials {
    Id?: string;
    Name?: string;
    AccessToken?: string;
    UserId?: string;
    ExchangeToken?: string;
    UserLinkType?: string;
    LocalAddress?: string;
    ManualAddress?: string;
    RemoteAddress?: string;
    ConnectServerId?: string;
    LastConnectionMode?: number | null;
    DateLastAccessed?: number;
    manualAddressOnly?: boolean;
}

export interface CredentialStore {
    Servers: ServerCredentials[];
}

function read(): CredentialStore {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') {
            const store = parsed as CredentialStore;
            // `Servers` es un invariante del que tira todo el resto de la capa
            // de conexión sin comprobarlo.
            if (!Array.isArray(store.Servers)) store.Servers = [];
            return store;
        }
    } catch {
        // Almacenamiento ilegible: se empieza de cero. Peor sería no arrancar.
    }
    return { Servers: [] };
}

export default class Credentials {
    private store: CredentialStore | null;

    constructor(private key: string = STORAGE_KEY) {
        this.store = read();
    }

    /** Sin argumento lee; con argumento guarda y persiste. */
    credentials(data?: CredentialStore): CredentialStore | null {
        if (data) {
            this.store = data;
            try {
                localStorage.setItem(this.key, JSON.stringify(data));
            } catch {
                // Cuota llena o modo privado: la sesión sigue viva en memoria,
                // que es mejor que propagar el fallo hasta el arranque.
            }
            Events.trigger(this, 'credentialsupdated');
        }
        return this.store;
    }

    clear(): void {
        this.store = null;
        localStorage.removeItem(this.key);
    }

    /**
     * Mete el servidor en la lista, o funde sus datos con el que ya estaba.
     *
     * Fundir en vez de reemplazar es lo que hace que reconectar por una
     * dirección no borre lo que se sabe de las otras: cada campo solo pisa al
     * anterior si viene informado.
     */
    addOrUpdateServer(list: ServerCredentials[], server: ServerCredentials): ServerCredentials {
        if (!server.Id) {
            throw new Error('Server.Id cannot be null or empty');
        }

        const existing = list.filter(({ Id }) => Id === server.Id)[0];
        if (!existing) {
            list.push(server);
            return server;
        }

        // El acceso más reciente manda, venga del que venga.
        existing.DateLastAccessed = Math.max(
            existing.DateLastAccessed || 0,
            server.DateLastAccessed || 0
        );
        existing.UserLinkType = server.UserLinkType;

        // El token y el usuario van juntos: un token nuevo sin su usuario
        // dejaría la sesión a medias.
        if (server.AccessToken) {
            existing.AccessToken = server.AccessToken;
            existing.UserId = server.UserId;
        }
        if (server.ExchangeToken) existing.ExchangeToken = server.ExchangeToken;
        if (server.RemoteAddress) existing.RemoteAddress = server.RemoteAddress;
        if (server.ManualAddress) existing.ManualAddress = server.ManualAddress;
        if (server.LocalAddress) existing.LocalAddress = server.LocalAddress;
        if (server.Name) existing.Name = server.Name;
        if (server.LastConnectionMode != null) existing.LastConnectionMode = server.LastConnectionMode;
        if (server.ConnectServerId) existing.ConnectServerId = server.ConnectServerId;

        return existing;
    }
}
