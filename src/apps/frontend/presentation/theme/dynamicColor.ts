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
 * El consumidor (FadeLayer de Backdrop) lo usa como base de
 * `background-position-x`, AMORTIGUADO a medio recorrido hacia el centro.
 * Con el valor tal cual, un porcentaje ahí significa «alinea ese punto de la
 * IMAGEN con ese punto del CONTENEDOR», que es la semántica de un punto
 * focal y tiene una propiedad que viene de regalo: el punto elegido nunca se
 * sale del recorte visible, por estrecho que sea. La demostración: con una
 * fracción visible f, el centro de la ventana queda en `c + f·(0.5 - c)`,
 * que dista del foco `f·|0.5 - c| ≤ f/2`, y f/2 es exactamente la
 * semianchura de la ventana.
 */
// Lookup table para sRGB -> luma linealizada
const SRGB_TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    const v = i / 255;
    SRGB_TO_LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// Kernel Gaussiano 1D separable de 5 coeficientes (σ ≈ 1.0, suma = 1.0)
const GAUSS_5 = [0.0545, 0.2442, 0.4026, 0.2442, 0.0545] as const;

function labF(t: number): number {
    return t > 0.00885645167 ? Math.cbrt(t) : 7.787037 * t + 0.13793103;
}

/**
 * Dónde está lo que importa de la imagen, en % de su ancho.
 *
 * Algoritmo combinado multi-señal:
 *   1. Saliencia cromática CIELAB (35%): distancia perceptiva ΔE respecto a la media de la imagen.
 *   2. Bordes en luma linealizada (55%): gradientes horizontal y vertical.
 *   3. Detección de piel en espacio YCbCr (10%): proxy rápido de rostros humanos (Cb∈[77,127], Cr∈[133,173]).
 *   4. Suavizado gaussiano 5×5 separable (σ≈1.0): filtra picos de ruido aislados.
 *   5. Regla de los tercios: boost ×1.08 suave en 1/3 y 2/3 del ancho, decayendo en ±15 columnas.
 *   6. Centroide ponderado de los picos que superan la media, acotado entre FOCUS_MIN (20%) y FOCUS_MAX (80%).
 */
export function focusFromPixels(
    data: Uint8ClampedArray, w: number, h: number
): number | null {
    if (w < 3 || h < 3) return null;

    const n = w * h;
    const lumaLin = new Float32Array(n);
    const labL = new Float32Array(n);
    const labA = new Float32Array(n);
    const labB = new Float32Array(n);
    const skin = new Uint8Array(n);

    let sumL = 0;
    let sumA = 0;
    let sumB = 0;

    // Pasada 1: Luma linealizada, conversión a CIELAB (D65) y detección de piel YCbCr
    for (let i = 0, p = 0; p < n; i += 4, p++) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Luma linealizada
        const rLin = SRGB_TO_LIN[r];
        const gLin = SRGB_TO_LIN[g];
        const bLin = SRGB_TO_LIN[b];
        lumaLin[p] = 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;

        // Linear sRGB -> CIEXYZ -> CIELAB (referencia D65: Xn=0.95047, Yn=1.0, Zn=1.08883)
        const X = (0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin) / 0.95047;
        const Y = (0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin);
        const Z = (0.0193339 * rLin + 0.1191920 * gLin + 0.9503041 * bLin) / 1.08883;

        const fx = labF(X);
        const fy = labF(Y);
        const fz = labF(Z);

        const L = 116 * fy - 16;
        const A = 500 * (fx - fy);
        const B = 200 * (fy - fz);

        labL[p] = L;
        labA[p] = A;
        labB[p] = B;

        sumL += L;
        sumA += A;
        sumB += B;

        // Detección de piel YCbCr (Cb∈[77,127] AND Cr∈[133,173])
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
            skin[p] = 1;
        }
    }

    const meanL = sumL / n;
    const meanA = sumA / n;
    const meanB = sumB / n;

    // Pasada 2: Bordes y Saliencia cromática
    const edge = new Float32Array(n);
    const sal = new Float32Array(n);
    let maxEdge = 0;
    let maxSal = 0;

    for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
            const p = row + x;

            // Bordes en luma linealizada
            let e = 0;
            if (x > 0) e += Math.abs(lumaLin[p] - lumaLin[p - 1]);
            if (y > 0) e += Math.abs(lumaLin[p] - lumaLin[p - w]);
            edge[p] = e;
            if (e > maxEdge) maxEdge = e;

            // Saliencia cromática respecto a la media de la imagen (distancia ΔE)
            const dL = labL[p] - meanL;
            const dA = labA[p] - meanA;
            const dB = labB[p] - meanB;
            const s = Math.sqrt(dL * dL + dA * dA + dB * dB);
            sal[p] = s;
            if (s > maxSal) maxSal = s;
        }
    }

    // Si la imagen es homogénea (sin bordes apreciables, ΔE < 1.0 imperceptible y sin piel),
    // no hay ningún sujeto a encuadrar y el centro es la respuesta correcta.
    const hasEdges = maxEdge > 0.005;
    const hasSaliency = maxSal >= 1.0;
    let hasSkin = false;
    for (let p = 0; p < n; p++) {
        if (skin[p] === 1) {
            hasSkin = true;
            break;
        }
    }
    if (!hasEdges && !hasSaliency && !hasSkin) {
        return null;
    }

    // Pasada 3: Fusión ponderada (55% bordes + 35% saliencia + 10% piel)
    const combined = new Float32Array(n);
    const invEdge = hasEdges ? 1 / maxEdge : 0;
    const invSal = hasSaliency ? 1 / maxSal : 0;

    for (let p = 0; p < n; p++) {
        const normEdge = edge[p] * invEdge;
        const normSal = sal[p] * invSal;
        const normSkin = skin[p];
        combined[p] = 0.55 * normEdge + 0.35 * normSal + 0.10 * normSkin;
    }

    // Pasada 4: Blur Gaussiano 5×5 separable (σ ≈ 1.0)
    // 4a. Horizontal
    const hBlur = new Float32Array(n);
    for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
            let acc = 0;
            for (let k = -2; k <= 2; k++) {
                const kx = Math.min(w - 1, Math.max(0, x + k));
                acc += combined[row + kx] * GAUSS_5[k + 2];
            }
            hBlur[row + x] = acc;
        }
    }

    // 4b. Vertical + acumulación en energía por columna
    const colEnergy = new Float32Array(w);
    for (let x = 0; x < w; x++) {
        let colSum = 0;
        for (let y = 0; y < h; y++) {
            let acc = 0;
            for (let k = -2; k <= 2; k++) {
                const ky = Math.min(h - 1, Math.max(0, y + k));
                acc += hBlur[ky * w + x] * GAUSS_5[k + 2];
            }
            colSum += acc;
        }
        colEnergy[x] = colSum;
    }

    // Pasada 5: Regla de los tercios (boost suave ×1.08 en 1/3 y 2/3 con decaimiento lineal en ±15 columnas)
    const t1 = w / 3;
    const t2 = (2 * w) / 3;
    let total = 0;

    for (let x = 0; x < w; x++) {
        const dist = Math.min(Math.abs(x - t1), Math.abs(x - t2));
        const boost = dist < 15 ? 1.0 + 0.08 * (1 - dist / 15) : 1.0;
        colEnergy[x] *= boost;
        total += colEnergy[x];
    }

    if (total <= 0) return null;

    // Pasada 6: Centroide sobre los picos que superan la media
    const mean = total / w;
    let weighted = 0;
    let mass = 0;
    for (let x = 0; x < w; x++) {
        const peak = colEnergy[x] - mean;
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

// El encuadre se guarda aparte del análisis completo porque se resuelve ANTES:
// no necesita la librería de color, solo los píxeles. Ver `imageFocus`.
const focusCache = new Map<string, number | null>();

function focusSet(url: string, focus: number | null): void {
    focusCache.delete(url);
    focusCache.set(url, focus);
    while (focusCache.size > CACHE_MAX) {
        const oldest = focusCache.keys().next();
        if (oldest.done) break;
        focusCache.delete(oldest.value);
    }
}

// ── IndexedDB: L2 persistente ───────────────────────────────────────────
//
// Las cachés en memoria (L1) se pierden al recargar. IndexedDB retiene los
// resultados entre sesiones — las mismas imágenes (pósteres, backdrops) no
// cambian y re-analizarlas es trabajo tirado. TTL de 90 días: si el
// servidor regenera las URLs (distinto tag de cache-bust), la entrada vieja
// caduca sola sin necesidad de gc manual.
//
// Las lecturas son async, pero solo se hacen en cache miss de L1 — es decir,
// una vez por URL y sesión. Las escrituras son fire-and-forget: si IDB falla
// (modo privado, cuota, jsdom) la app funciona igual con el L1 solo.

const IDB_NAME = 'jfp-dynamic-color';
const IDB_STORE = 'analysis';
const IDB_VERSION = 1;
/** 90 días en milisegundos. */
const IDB_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type IdbEntry = {
    url: string;
    seed: string | null;
    focusX: number | null;
    ts: number;
};

function openIdb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE, { keyPath: 'url' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch {
            // indexedDB.open puede lanzar en ciertos contextos restringidos.
            resolve(null);
        }
    });
}

/** Promesa única para no abrir N conexiones en paralelo. */
let idbPromise: Promise<IDBDatabase | null> | null = null;

function getIdb(): Promise<IDBDatabase | null> {
    idbPromise ??= openIdb();
    return idbPromise;
}

/** Lee un análisis de IndexedDB (L2). Devuelve undefined si no existe o expiró. */
async function idbGet(url: string): Promise<ImageAnalysis | undefined> {
    const db = await getIdb();
    if (!db) return undefined;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(url);
            req.onsuccess = () => {
                const entry = req.result as IdbEntry | undefined;
                if (!entry || Date.now() - entry.ts > IDB_TTL_MS) {
                    resolve(undefined);
                    return;
                }
                resolve({ seed: entry.seed, focusX: entry.focusX });
            };
            req.onerror = () => resolve(undefined);
        } catch {
            resolve(undefined);
        }
    });
}

/** Guarda un análisis en IndexedDB (L2). Fire-and-forget. */
function idbSet(url: string, analysis: ImageAnalysis): void {
    void getIdb().then((db) => {
        if (!db) return;
        try {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            const entry: IdbEntry = {
                url,
                seed: analysis.seed,
                focusX: analysis.focusX,
                ts: Date.now()
            };
            store.put(entry);
        } catch {
            // Cuota llena o contexto restringido: silencioso.
        }
    });
}

/** Limpia todo el object store de IndexedDB. */
function idbClear(): void {
    void getIdb().then((db) => {
        if (!db) return;
        try {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).clear();
        } catch {
            // Silencioso.
        }
    });
}

/** Solo para tests: vacía la memoización (L1 + L2). */
export function resetAnalysisCache(): void {
    cache.clear();
    focusCache.clear();
    sampling.clear();
    idbClear();
}

/** Solo para tests: cuántas imágenes hay memoizadas ahora mismo (L1). */
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

/** La imagen bajada a un canvas: lo caro, y lo que comparten seed y encuadre. */
type Sampled = { data: Uint8ClampedArray; w: number; h: number };

// Muestreos en vuelo. El hero pide seed y encuadre en el mismo commit, y sin
// esto serían dos descargas y dos decodificaciones de la MISMA imagen. Solo
// guarda lo que está a medias: al terminar, el resultado ya vive en las cachés
// y el pixel buffer se puede tirar (son ~20 KB por imagen).
const sampling = new Map<string, Promise<Sampled | null>>();

async function readPixels(url: string): Promise<Sampled | null> {
    try {
        const img = await loadImage(url);
        const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
        const w = SAMPLE;
        const h = Math.max(1, Math.round(SAMPLE * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, w, h);
        return { data: ctx.getImageData(0, 0, w, h).data, w, h };
    } catch {
        // Imagen inaccesible o canvas tainted: no hay píxeles que mirar.
        return null;
    }
}

function sampleImage(url: string): Promise<Sampled | null> {
    const inflight = sampling.get(url);
    if (inflight) return inflight;
    const job = readPixels(url);
    sampling.set(url, job);
    void job.finally(() => {
        if (sampling.get(url) === job) sampling.delete(url);
    });
    return job;
}

/**
 * Encuadre de la imagen, sin esperar a la librería de color.
 *
 * Va por su cuenta y no por `analyzeImage` porque el encuadre TIENE que estar
 * listo antes de la primera pintada: si llega después, la imagen aparece
 * centrada y se desliza a su sitio a la vista del usuario. Y de las dos cosas
 * que salen de los píxeles, el encuadre es la que no necesita los ~100 KB del
 * chunk de Material — hacerle esperar a ese `import()` era justo lo que abría
 * la ventana del salto.
 */
export async function imageFocus(url: string): Promise<number | null> {
    const memo = peekImageFocus(url);
    if (memo !== undefined) return memo;
    // L2: IndexedDB puede tener el encuadre de una sesión anterior.
    const persisted = await idbGet(url);
    if (persisted) {
        focusSet(url, persisted.focusX);
        // Aprovecha para hidratar la caché completa.
        cacheSet(url, persisted);
        return persisted.focusX;
    }
    const px = await sampleImage(url);
    const focus = px ? focusFromPixels(px.data, px.w, px.h) : null;
    focusSet(url, focus);
    return focus;
}

/**
 * El encuadre ya memoizado, sin promesa de por medio. `undefined` = todavía no
 * se sabe. Sirve para pintar bien A LA PRIMERA una imagen ya vista (el carrusel
 * que vuelve a un slide, una ficha que se reabre): con un `await` de por medio,
 * aunque el valor esté en memoria, React ya ha pintado un frame centrado.
 */
export function peekImageFocus(url: string): number | null | undefined {
    return focusCache.get(url);
}

/** Seed y encuadre de la imagen; ambos a null si no se pudo leer. */
export async function analyzeImage(url: string): Promise<ImageAnalysis> {
    const memo = cacheGet(url);
    if (memo !== undefined) return memo;

    // L2: IndexedDB retiene resultados entre sesiones.
    const persisted = await idbGet(url);
    if (persisted) {
        cacheSet(url, persisted);
        focusSet(url, persisted.focusX);
        return persisted;
    }

    let analysis = UNREADABLE;
    try {
        // En paralelo: la imagen viaja por la red mientras llega el chunk.
        const [px, lib] = await Promise.all([sampleImage(url), loadColorLib()]);
        if (px) {
            const { data, w, h } = px;
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
            focusSet(url, analysis.focusX);
        }
    } catch {
        // El chunk de color no llegó, o la imagen no se pudo leer: sin seed. El
        // encuadre no depende de esto y lo resuelve `imageFocus` por su cuenta,
        // así que aquí no se toca su caché.
        analysis = UNREADABLE;
    }
    // Se memoiza también el fallo, para no reintentarlo en cada rotación del
    // carrusel.
    cacheSet(url, analysis);
    idbSet(url, analysis);
    return analysis;
}
