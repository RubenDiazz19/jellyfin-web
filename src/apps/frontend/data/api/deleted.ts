// Los items borrados en esta sesión.
//
// Borrar es lo único que convierte una petición perfectamente normal —«dame la
// ficha de este item»— en un 404 garantizado. Y esa petición sale de sitios
// que no tienen forma de enterarse del borrado: la pantalla de Favoritos
// hidrata cada favorito por su id, uno a uno, y si alguno ya no está, lo que
// llega a la interfaz es un error de red como si algo se hubiera roto.
//
// Avisar a cada llamante es la parte frágil: basta con que aparezca uno nuevo
// para que el 404 vuelva. Aquí se corta abajo del todo — si el id está
// marcado, la petición ni sale.
//
// La marca CADUCA a propósito. Jellyfin deriva el id del contenido, así que
// volver a meter el mismo fichero y reescanear devuelve el MISMO id: pasado un
// rato, la ficha tiene que poder pedirse otra vez.

import globalize from 'lib/globalize';

/** Cuánto se recuerda que un item se borró. */
const TTL_MS = 10 * 60 * 1000;

const deletedAt = new Map<string, number>();

export function markDeleted(itemId: string): void {
    deletedAt.set(itemId, Date.now());
}

export function isDeleted(itemId: string): boolean {
    const when = deletedAt.get(itemId);
    if (when === undefined) return false;
    if (Date.now() - when < TTL_MS) return true;
    deletedAt.delete(itemId);
    return false;
}

/**
 * El error con el que se rechaza pedir un item borrado.
 *
 * Va traducido porque puede acabar en pantalla: si alguien abre por URL la
 * ficha de algo que ya no está, es más útil leer que el título no existe que
 * un código HTTP.
 */
export function itemGoneError(): Error {
    return new Error(globalize.translate('MessageItemNoLongerAvailable'));
}

/** Solo para tests. */
export function _resetDeleted(): void {
    deletedAt.clear();
}
