// Dynamic color (M3): extrae el color fuente dominante de una imagen (el
// backdrop del hero) con el pipeline oficial de Material: downscale →
// quantización Celebi → Score (ranking que prima chroma y presencia y
// descarta colores feos/neutros).

import {
    argbFromRgb,
    Hct,
    hexFromArgb,
    QuantizerCelebi,
    Score
} from '@material/material-color-utilities';

// Lado mayor del downscale. 96px ≈ 9k píxeles: suficiente para el ranking
// y barato de cuantizar (< 10 ms).
const SAMPLE = 96;
const MAX_COLORS = 128;

// Normalización del seed. SchemeContent usa el color fuente TAL CUAL para el
// primary-container, así que un póster oscuro y lavado (un rojo casi marrón)
// pintaría una interfaz apagada y con poco contraste. Se conserva el tono de
// color —lo que hace que un póster de Batman se lea "rojo"— y se llevan croma
// y luminosidad a la banda en la que M3 construye contenedores legibles.
const MIN_CHROMA = 40;
const MIN_TONE = 38;
const MAX_TONE = 72;
// Por debajo de esto la imagen no tiene color (blanco y negro): subirle el
// croma inventaría un tinte al azar, así que mejor dejar la seed que hubiera.
const NEUTRAL_CHROMA = 8;

function normalizeSeed(argb: number): string | null {
    const hct = Hct.fromInt(argb);
    if (hct.chroma < NEUTRAL_CHROMA) return null;
    if (hct.chroma < MIN_CHROMA) hct.chroma = MIN_CHROMA;
    hct.tone = Math.min(MAX_TONE, Math.max(MIN_TONE, hct.tone));
    return hexFromArgb(hct.toInt());
}

// Un backdrop se re-extrae a menudo (rotación del carrusel vuelve al mismo
// slide); memoizar por URL evita repetir el trabajo de canvas+quantizador.
//
// LRU con tope: una sesión larga recorriendo la biblioteca pasa por cientos de
// imágenes y un Map sin límite las acumula todas para siempre. Aprovecha que
// un Map de JS conserva el orden de inserción: la primera clave es la menos
// usada recientemente (cada acierto la reinserta al final), así que desalojar
// es borrar esa.
const CACHE_MAX = 50;
const cache = new Map<string, string | null>();

/** Lee de la caché marcando el acierto como el más reciente. */
function cacheGet(url: string): string | null | undefined {
    if (!cache.has(url)) return undefined;
    const hit = cache.get(url) as string | null;
    cache.delete(url);
    cache.set(url, hit);
    return hit;
}

function cacheSet(url: string, seed: string | null): void {
    cache.delete(url);
    cache.set(url, seed);
    while (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next();
        if (oldest.done) break;
        cache.delete(oldest.value);
    }
}

/** Solo para tests: vacía la memoización. */
export function resetSeedCache(): void {
    cache.clear();
}

/** Solo para tests: cuántas imágenes hay memoizadas ahora mismo. */
export function seedCacheSize(): number {
    return cache.size;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Necesario para poder leer los píxeles si el server está en otro
        // origen (Jellyfin sirve las imágenes con CORS abierto).
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
        img.src = url;
    });
}

/** Seed #rrggbb dominante de la imagen, o null si no se pudo extraer. */
export async function seedFromImage(url: string): Promise<string | null> {
    const memo = cacheGet(url);
    if (memo !== undefined) return memo;

    let seed: string | null = null;
    try {
        const img = await loadImage(url);
        const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
        const w = SAMPLE;
        const h = Math.max(1, Math.round(SAMPLE * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const data = ctx.getImageData(0, 0, w, h).data;
            const pixels: number[] = [];
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 255) continue; // ignora píxeles translúcidos
                pixels.push(argbFromRgb(data[i], data[i + 1], data[i + 2]));
            }
            const ranked = Score.score(QuantizerCelebi.quantize(pixels, MAX_COLORS));
            seed = ranked.length ? normalizeSeed(ranked[0]) : null;
        }
    } catch {
        seed = null; // imagen inaccesible o canvas tainted: sin dynamic color
    }
    cacheSet(url, seed);
    return seed;
}
