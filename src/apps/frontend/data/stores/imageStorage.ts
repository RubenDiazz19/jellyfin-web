// Imágenes personalizadas (backdrop/póster) guardadas como data URL en
// localStorage, indexadas por clave arbitraria.
//
// OJO — hoy esto es SOLO DE LECTURA en la práctica: no queda ni un llamador de
// `setImage` en el repo. Los fondos que el usuario pone ahora van al servidor
// (`listsStore.setCover` → `remote-images`) y aquí solo puede haber datos que
// dejara una versión anterior del frontend. Se conserva la lectura para no
// hacer desaparecer esos fondos de golpe.
//
// Por eso NO se ha migrado a IndexedDB: migrar una ruta de escritura que nadie
// usa sería ceremonia. Lo que sí costaba —cada `getImage` es un `getItem`
// síncrono que puede devolver cientos de KB, y `Backdrop` lo llama en CADA
// render— se arregla memoizando: la data URL se lee una vez por clave.

const KEY_PREFIX = 'img_';

/** clave → data URL leída (o `null` si no había nada). */
const cache = new Map<string, string | null>();

export function getImage(key: string): string | null {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let value: string | null = null;
    try {
        value = localStorage.getItem(`${KEY_PREFIX}${key}`);
    } catch {
        value = null;
    }
    cache.set(key, value);
    return value;
}

export function setImage(key: string, dataUrl: string) {
    try {
        localStorage.setItem(`${KEY_PREFIX}${key}`, dataUrl);
        cache.set(key, dataUrl);
    } catch {
        // Cuota agotada — silencioso, igual que en el prototipo original.
        // La caché no se toca: seguiría valiendo lo que hubiera en disco.
    }
}
