// Análisis del backdrop del hero. De una sola decodificación salen dos cosas:
//
//   1. La seed del dynamic color (M3): el color fuente dominante, con el
//      pipeline oficial de Material — downscale → quantización Celebi → Score
//      (ranking que prima chroma y presencia y descarta colores feos/neutros).
//   2. El punto de interés horizontal, para encuadrar la imagen en vertical.
//
// Van juntas porque comparten lo caro: bajar la imagen a un canvas y leer sus
// píxeles. Calcular la segunda es un recorrido más de un array que ya está en
// memoria.

// La librería de color se carga con `import()` y no de forma estática: son
// ~100 KB que solo hacen falta en mobile/tablet, y este módulo lo importa el
// provider del tema, que está en el shell (ver colorScheme.ts). El primer
// análisis paga la descarga; los siguientes reutilizan la promesa.
let colorLib: Promise<typeof import('@material/material-color-utilities')> | null = null;

function loadColorLib() {
    colorLib ??= import('@material/material-color-utilities');
    return colorLib;
}

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

type ColorLib = Awaited<ReturnType<typeof loadColorLib>>;

function normalizeSeed(argb: number, { Hct, hexFromArgb }: ColorLib): string | null {
    const hct = Hct.fromInt(argb);
    if (hct.chroma < NEUTRAL_CHROMA) return null;
    if (hct.chroma < MIN_CHROMA) hct.chroma = MIN_CHROMA;
    hct.tone = Math.min(MAX_TONE, Math.max(MIN_TONE, hct.tone));
    return hexFromArgb(hct.toInt());
}

// Topes del encuadre: pegar el recorte al borde de la imagen se lee como un
// error de maquetación aunque el sujeto esté ahí. Entre el 20% y el 80% el
// encuadre sigue siendo deliberado.
const FOCUS_MIN = 20;
const FOCUS_MAX = 80;

/**
 * Dónde está lo que importa de la imagen, en % de su ancho.
 *
 * Un fotograma es 16:9 y el hero de un móvil en vertical es casi 9:20. Con
 * `background-size: cover` la imagen se escala hasta llenar el alto y le sobra
 * ~el 74% del ancho, que se recorta A PARTES IGUALES por los dos lados: se ve
 * la columna CENTRAL. Si el personaje no está justo en el centro, se corta.
 *
 * Así que se busca dónde está el detalle. La energía de bordes por columna
 * —cuánto cambia la imagen de un píxel al de al lado— separa bastante bien al
 * sujeto del fondo: una cara tiene contorno, ojos y pelo, y un fondo
 * desenfocado no tiene nada. De esa energía se toma el centroide de lo que
 * SUPERA LA MEDIA, no el centroide a secas: así una textura repartida por toda
 * la imagen (una pared de ladrillo) no arrastra el resultado al centro y solo
 * pesan los picos.
 *
 * El valor se usa tal cual como `background-position-x`. Un porcentaje ahí
 * significa «alinea ese punto de la IMAGEN con ese punto del CONTENEDOR», que
 * es justo la semántica de un punto focal, y tiene una propiedad que viene de
 * regalo: el punto elegido nunca se sale del recorte visible, por estrecho que
 * sea. La demostración: con una fracción visible f, el centro de la ventana
 * queda en `c + f·(0.5 - c)`, que dista del foco `f·|0.5 - c| ≤ f/2`, y f/2 es
 * exactamente la semianchura de la ventana.
 */
export function focusFromPixels(
    data: Uint8ClampedArray, w: number, h: number
): number | null {
    if (w < 3 || h < 3) return null;

    // Luma sin linearizar: aquí solo se miran DIFERENCIAS entre vecinos, y para
    // detectar un borde da igual el espacio de color.
    const luma = new Float32Array(w * h);
    for (let i = 0, p = 0; p < luma.length; i += 4, p++) {
        luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }

    const energy = new Float32Array(w);
    for (let y = 1; y < h; y++) {
        for (let x = 1; x < w; x++) {
            const p = y * w + x;
            energy[x] += Math.abs(luma[p] - luma[p - 1]) + Math.abs(luma[p] - luma[p - w]);
        }
    }

    let total = 0;
    for (let x = 0; x < w; x++) total += energy[x];
    // Imagen plana (un color liso, o el canvas vacío de jsdom): no hay nada que
    // encuadrar y el centro de siempre es la respuesta correcta.
    if (total <= 0) return null;

    const mean = total / w;
    let weighted = 0;
    let mass = 0;
    for (let x = 0; x < w; x++) {
        const peak = energy[x] - mean;
        if (peak <= 0) continue;
        weighted += peak * (x + 0.5);
        mass += peak;
    }
    if (mass <= 0) return null;

    const pct = (weighted / mass / w) * 100;
    return Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, Math.round(pct * 10) / 10));
}

/** Lo que se saca de una imagen en una sola pasada. */
export type ImageAnalysis = {
    /** Seed #rrggbb dominante, o null si la imagen no tiene color usable. */
    seed: string | null;
    /** Punto de interés horizontal en % del ancho, o null si no se pudo medir. */
    focusX: number | null;
};

const UNREADABLE: ImageAnalysis = { seed: null, focusX: null };

// Un backdrop se re-analiza a menudo (rotación del carrusel vuelve al mismo
// slide); memoizar por URL evita repetir el trabajo de canvas+quantizador.
//
// LRU con tope: una sesión larga recorriendo la biblioteca pasa por cientos de
// imágenes y un Map sin límite las acumula todas para siempre. Aprovecha que
// un Map de JS conserva el orden de inserción: la primera clave es la menos
// usada recientemente (cada acierto la reinserta al final), así que desalojar
// es borrar esa.
const CACHE_MAX = 50;
const cache = new Map<string, ImageAnalysis>();

/** Lee de la caché marcando el acierto como el más reciente. */
function cacheGet(url: string): ImageAnalysis | undefined {
    if (!cache.has(url)) return undefined;
    const hit = cache.get(url) as ImageAnalysis;
    cache.delete(url);
    cache.set(url, hit);
    return hit;
}

function cacheSet(url: string, analysis: ImageAnalysis): void {
    cache.delete(url);
    cache.set(url, analysis);
    while (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next();
        if (oldest.done) break;
        cache.delete(oldest.value);
    }
}

/** Solo para tests: vacía la memoización. */
export function resetAnalysisCache(): void {
    cache.clear();
}

/** Solo para tests: cuántas imágenes hay memoizadas ahora mismo. */
export function analysisCacheSize(): number {
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

/** Seed y encuadre de la imagen; ambos a null si no se pudo leer. */
export async function analyzeImage(url: string): Promise<ImageAnalysis> {
    const memo = cacheGet(url);
    if (memo !== undefined) return memo;

    let analysis = UNREADABLE;
    try {
        // En paralelo: la imagen viaja por la red mientras llega el chunk.
        const [img, lib] = await Promise.all([loadImage(url), loadColorLib()]);
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
                pixels.push(lib.argbFromRgb(data[i], data[i + 1], data[i + 2]));
            }
            const ranked = lib.Score.score(lib.QuantizerCelebi.quantize(pixels, MAX_COLORS));
            analysis = {
                seed: ranked.length ? normalizeSeed(ranked[0], lib) : null,
                focusX: focusFromPixels(data, w, h)
            };
        }
    } catch {
        // Imagen inaccesible o canvas tainted: ni color ni encuadre. Se memoiza
        // el fallo para no reintentarlo en cada rotación del carrusel.
        analysis = UNREADABLE;
    }
    cacheSet(url, analysis);
    return analysis;
}
