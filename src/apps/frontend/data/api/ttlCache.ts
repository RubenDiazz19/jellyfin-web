// La fontanería común de los tres cachés en memoria de la capa de datos
// (`cache.ts` para series, `listCache.ts` para listados, `playbackCache.ts`
// para la negociación de reproducción).
//
// Lo que comparten es exactamente esto: un `Map`, una clave con el usuario
// delante, un sello de tiempo con TTL y la comprobación de identidad que hace
// falta cuando una carga asíncrona vuelve y a lo mejor ya la han invalidado.
// Lo que NO comparten —revalidación en segundo plano, bypass `fresh`, desalojo
// del error— se queda en cada uno: son políticas distintas a propósito y
// meterlas aquí haría el helper más difícil de leer que los tres juntos.
//
// Por qué el usuario va en la CLAVE y no como filtro: todo lo cacheado lleva
// estado por cuenta (visto, progreso, URLs firmadas con su token), y al
// cambiar de usuario en la misma pestaña la sesión nueva leía lo de la
// anterior hasta que venciera el TTL.

import { loadSession } from '../session/session';

/** Una entrada con su sello. El valor lo interpreta cada caché. */
export type Stamped<T> = {
    value: T;
    /** Cuándo se selló por última vez (carga o revalidación). */
    at: number;
};

export type TtlCacheOptions = {
    ttlMs: number;
    /**
     * Antepone el userId de la sesión a cada clave. Los cachés que reciben el
     * usuario por parámetro (porque lo llaman desde donde ya lo tienen) lo
     * dejan en false y lo pasan como una parte más de la clave.
     */
    userScoped?: boolean;
};

export function createTtlCache<T>({ ttlMs, userScoped = false }: TtlCacheOptions) {
    const entries = new Map<string, Stamped<T>>();

    const isFresh = (entry: Stamped<T>) => Date.now() - entry.at <= ttlMs;

    return {
        /**
         * Clave a partir de sus partes. El separador no puede aparecer ni en
         * un userId ni en un id de item, así que dos claves distintas no
         * pueden colapsar en la misma.
         */
        key(...parts: string[]): string {
            const scope = userScoped ? [loadSession()?.userId ?? ''] : [];
            return [...scope, ...parts].join('.');
        },

        /** El valor si sigue fresco. Una entrada vencida se desaloja al leerla. */
        get(key: string): T | undefined {
            const entry = entries.get(key);
            if (!entry) return undefined;
            if (!isFresh(entry)) {
                entries.delete(key);
                return undefined;
            }
            return entry.value;
        },

        /**
         * La entrada tal cual, fresca o vencida y sin desalojar nada. La usan
         * las políticas que sirven lo caducado mientras revalidan.
         */
        peek(key: string): Stamped<T> | undefined {
            return entries.get(key);
        },

        isFresh,

        set(key: string, value: T): Stamped<T> {
            const entry = { value, at: Date.now() };
            entries.set(key, entry);
            return entry;
        },

        /** Renueva el sello sin cambiar el valor. */
        touch(entry: Stamped<T>): void {
            entry.at = Date.now();
        },

        /**
         * True si `entry` sigue siendo la guardada bajo esa clave.
         *
         * Es la comprobación que evita resucitar datos obsoletos: entre que se
         * lanza una carga y vuelve, una mutación puede haber invalidado el
         * caché, y esa respuesta es ANTERIOR a la mutación.
         */
        holds(key: string, entry: Stamped<T>): boolean {
            return entries.get(key) === entry;
        },

        delete(key: string): void {
            entries.delete(key);
        },

        /** Borra todo lo que cuelgue de un prefijo (p. ej. un item concreto). */
        deleteByPrefix(prefix: string): void {
            for (const key of entries.keys()) {
                if (key.startsWith(prefix)) entries.delete(key);
            }
        },

        clear(): void {
            entries.clear();
        }
    };
}
