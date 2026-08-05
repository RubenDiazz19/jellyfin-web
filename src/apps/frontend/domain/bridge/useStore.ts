// Puente stores locales ↔ React.
//
// Los stores (favoritos, «visto», listas) no son signals: avisan de sus
// cambios con un evento global del `window`, porque los lee muchísimo código
// que no es React. Estos tres hooks son las tres formas de escuchar ese
// evento, y antes estaban copiadas una vez por store.
//
// El evento lleva en su `detail` los ids que han cambiado (ver `StoreChange`
// en persistentStore). Eso es lo que permite que marcar un episodio no
// repinte las decenas de tarjetas de la Home: cada suscriptor declara su
// ÁMBITO —la clave o el prefijo de clave que le interesa— y descarta el resto
// sin releer nada. Un evento sin `detail.ids` significa «cambió algo, no sé
// qué» y se acepta siempre, que es lo conservador.

import { useEffect, useRef, useState } from 'react';
import type { StoreChange } from '../../data/stores/persistentStore';

/**
 * True si el cambio anunciado por el evento toca el ámbito pedido.
 *
 * El ámbito casa por PREFIJO de clave, que es como están construidas: la
 * serie es `<showId>`, su temporada `<showId>-s2` y su episodio
 * `<showId>-s2-e3` (ver itemKeys). Así una vista que agrega la serie entera
 * declara el showId y se entera de cualquier episodio suyo, y solo de esos.
 */
function touches(e: Event, scope?: string): boolean {
    if (!scope) return true;
    const ids = (e as CustomEvent<StoreChange>).detail?.ids;
    if (!ids) return true;
    return ids.some((id) => id === scope || id.startsWith(`${scope}-`));
}

/**
 * Vuelve a leer `read()` cada vez que el store anuncia un cambio que afecta a
 * `key`.
 *
 * `key` identifica QUÉ se está leyendo (el id del item): al cambiar, el valor
 * se recalcula, y además es el ámbito con el que se filtran los eventos.
 * `read` no entra en las dependencias porque es una arrow nueva en cada render
 * que siempre lee lo mismo para un `key` dado; incluirla volvería a suscribir
 * en cada render sin ganar nada.
 */
export function useStoreValue<T>(event: string, key: string, read: () => T): T {
    const [value, setValue] = useState<T>(read);
    // `read` cambia de identidad en cada render pero el efecto solo se re-crea
    // con `key`: la ref garantiza que el listener llame siempre a la última.
    const latest = useRef(read);
    latest.current = read;
    useEffect(() => {
        const update = (e?: Event) => {
            if (e && !touches(e, key)) return;
            setValue(latest.current());
        };
        window.addEventListener(event, update);
        // Entre el primer render y este efecto el store ha podido cambiar, y
        // `key` puede ser otro que el de la última lectura.
        update();
        return () => window.removeEventListener(event, update);
    }, [event, key]);
    return value;
}

/**
 * Re-renderiza con cada cambio del store, sin leer nada en concreto. Para los
 * componentes que derivan estado agregado de varios ids a la vez (una
 * temporada entera, una serie entera) en vez de suscribirse a uno solo.
 *
 * `scope` acota a una rama del árbol de claves — el id de la serie, para una
 * vista que agrega sus episodios. Sin `scope` se repinta con CUALQUIER cambio
 * del store, que es lo que hay que evitar en una rejilla.
 */
export function useStoreVersion(event: string, scope?: string): void {
    const [, bump] = useState(0);
    useEffect(() => {
        const update = (e: Event) => {
            if (!touches(e, scope)) return;
            bump((n) => n + 1);
        };
        window.addEventListener(event, update);
        return () => window.removeEventListener(event, update);
    }, [event, scope]);
}

/**
 * Ejecuta `onChange` con cada cambio del store. Para las vistas que necesitan
 * reaccionar con lógica propia en vez de solo repintarse — p. ej. podar la
 * pantalla de Favoritos cuando se desmarca un item.
 */
export function useStoreListener(event: string, onChange: () => void): void {
    useEffect(() => {
        window.addEventListener(event, onChange);
        return () => window.removeEventListener(event, onChange);
    }, [event, onChange]);
}
