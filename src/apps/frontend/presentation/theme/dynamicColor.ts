// Dynamic color (M3): extrae el color fuente dominante de una imagen (el
// backdrop del hero) con el pipeline oficial de Material: downscale →
// quantización Celebi → Score (ranking que prima chroma y presencia y
// descarta colores feos/neutros).

import {
    argbFromRgb,
    hexFromArgb,
    QuantizerCelebi,
    Score
} from '@material/material-color-utilities';

// Lado mayor del downscale. 96px ≈ 9k píxeles: suficiente para el ranking
// y barato de cuantizar (< 10 ms).
const SAMPLE = 96;
const MAX_COLORS = 128;

// Un backdrop se re-extrae a menudo (rotación del carrusel vuelve al mismo
// slide); memoizar por URL evita repetir el trabajo de canvas+quantizador.
const cache = new Map<string, string | null>();

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
    const memo = cache.get(url);
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
            seed = ranked.length ? hexFromArgb(ranked[0]) : null;
        }
    } catch {
        seed = null; // imagen inaccesible o canvas tainted: sin dynamic color
    }
    cache.set(url, seed);
    return seed;
}
