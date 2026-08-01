// Puente stores locales ↔ React.
//
// Los stores (favoritos, «visto», listas) no son signals: avisan de sus
// cambios con un evento global del `window`, porque los lee muchísimo código
// que no es React. Estos tres hooks son las tres formas de escuchar ese
// evento, y antes estaban copiadas una vez por store.

import { useEffect, useState } from 'react';

/**
 * Vuelve a leer `read()` cada vez que el store anuncia un cambio.
 *
 * `key` identifica QUÉ se está leyendo (el id del item): al cambiar, el valor
 * se recalcula. `read` no entra en las dependencias porque es una arrow nueva
 * en cada render que siempre lee lo mismo para un `key` dado; incluirla
 * volvería a suscribir en cada render sin ganar nada.
 */
export function useStoreValue<T>(event: string, key: string, read: () => T): T {
    const [value, setValue] = useState<T>(read);
    useEffect(() => {
        const update = () => setValue(read());
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
 */
export function useStoreVersion(event: string): void {
    const [, bump] = useState(0);
    useEffect(() => {
        const update = () => bump((n) => n + 1);
        window.addEventListener(event, update);
        return () => window.removeEventListener(event, update);
    }, [event]);
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
