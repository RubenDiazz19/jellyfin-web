// Resultado de intentar conectar con un servidor. Lo produce el `connect()` de
// esta misma capa, así que el tipo vive aquí y no en la declaración del paquete
// `jellyfin-apiclient`: era nuestro desde el principio, solo que declarado en el
// sitio equivocado.

import type { ConnectionState } from './connectionState';

/**
 * Lo ÚNICO que los consumidores leen del cliente que viene en la respuesta: dos
 * getters. Por lo demás es un handle opaco que devuelven a esta capa
 * (`setLocalApiClient`).
 *
 * Se declara así, por forma y no importando la clase del paquete, porque es lo
 * que permite cambiar lo que hay detrás sin tocar a quien lo recibe — que es
 * justo el objetivo de D2. Si algún día alguien necesita algo más de este
 * objeto, que lo añada aquí: esta lista es la medida de cuánto queda por
 * desenganchar.
 */
export interface ConnectedServerHandle {
    serverId(): string;
    serverAddress(): string;
}

export interface ConnectResponse {
    ApiClient: ConnectedServerHandle;
    Servers: unknown[];
    State: ConnectionState;
}
