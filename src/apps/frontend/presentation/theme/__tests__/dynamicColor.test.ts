// Memoización de la extracción de seed: sin tope, una sesión larga por la
// biblioteca acumulaba una entrada por imagen vista y no soltaba ninguna.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    analysisCacheSize, analyzeImage, focusFromPixels, imageFocus, peekImageFocus,
    resetAnalysisCache
} from '../dynamicColor';

// `analyzeImage` carga la librería de color con `import()` (son ~100 KB que
// solo usan mobile y tablet). Precargarla saca la transformación de Vite
// —cientos de ms la primera vez— del reloj de cada test.
beforeAll(async () => { await import('@material/material-color-utilities'); });

// jsdom no carga imágenes ni pinta canvas: basta con que el `onload` llegue
// para recorrer el camino completo (el getContext devuelve null y la seed sale
// null, que también se memoiza — es justo el caso que interesa contar).
let built = 0;

class FakeImage {
    crossOrigin = '';
    naturalWidth = 100;
    naturalHeight = 150;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor() {
        built++;
    }

    set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
    }
}

describe('dynamicColor: caché de seeds', () => {
    beforeEach(() => {
        built = 0;
        resetAnalysisCache();
        vi.stubGlobal('Image', FakeImage);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        resetAnalysisCache();
    });

    it('memoiza por URL: la segunda vez no vuelve a decodificar', async () => {
        await analyzeImage('http://srv/a.jpg');
        await analyzeImage('http://srv/a.jpg');
        expect(built).toBe(1);
        expect(analysisCacheSize()).toBe(1);
    });

    it('no crece sin límite: se queda en el tope', async () => {
        for (let i = 0; i < 60; i++) await analyzeImage(`http://srv/${i}.jpg`);
        expect(analysisCacheSize()).toBe(50);
    });

    it('desaloja la menos usada, no la más antigua a secas', async () => {
        for (let i = 0; i < 50; i++) await analyzeImage(`http://srv/${i}.jpg`);
        built = 0;

        // Un acierto en la más vieja la vuelve la más reciente…
        await analyzeImage('http://srv/0.jpg');
        expect(built).toBe(0);

        // …así que al meter una nueva, la desalojada es la 1, no la 0.
        await analyzeImage('http://srv/nueva.jpg');
        expect(analysisCacheSize()).toBe(50);

        built = 0;
        await analyzeImage('http://srv/0.jpg');
        expect(built, 'la 0 seguía en caché').toBe(0);
        await analyzeImage('http://srv/1.jpg');
        expect(built, 'la 1 fue la desalojada').toBe(1);
    });
});

// El encuadre tiene que estar listo ANTES de la primera pintada: si llega
// después, la imagen aparece centrada y se recoloca a la vista del usuario.
// Por eso va por su cuenta y no colgando del análisis de color, que espera a un
// `import()` de ~100 KB que al encuadre no le hace ninguna falta.
describe('dynamicColor: el encuadre no cuelga del color', () => {
    // Aquí sí hace falta un canvas que devuelva píxeles: lo que se prueba es el
    // camino entero (descarga → muestreo → encuadre), no la función pura.
    const realGetContext = HTMLCanvasElement.prototype.getContext;

    /** Píxeles con el detalle en el tercio izquierdo. */
    function leftHeavy(w: number, h: number): Uint8ClampedArray {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const v = x < w / 3 && (x + y) % 2 === 0 ? 255 : 0;
                const i = (y * w + x) * 4;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
                data[i + 3] = 255;
            }
        }
        return data;
    }

    beforeEach(() => {
        built = 0;
        resetAnalysisCache();
        vi.stubGlobal('Image', FakeImage);
        HTMLCanvasElement.prototype.getContext = function fake(this: HTMLCanvasElement) {
            return {
                drawImage: () => undefined,
                getImageData: (_x: number, _y: number, w: number, h: number) => ({
                    data: leftHeavy(w, h)
                })
            };
        } as unknown as typeof realGetContext;
    });

    afterEach(() => {
        HTMLCanvasElement.prototype.getContext = realGetContext;
        vi.unstubAllGlobals();
        resetAnalysisCache();
    });

    it('una imagen sin ver todavía no tiene encuadre que consultar', () => {
        expect(peekImageFocus('http://srv/a.jpg')).toBeUndefined();
    });

    it('tras medirla, el encuadre se lee sin promesa de por medio', async () => {
        const focus = await imageFocus('http://srv/a.jpg');
        expect(focus).not.toBeNull();
        expect(focus).toBeLessThan(40); // el detalle está a la izquierda

        // Esto es lo que evita el salto al volver a la misma imagen: el valor
        // está disponible en el mismo render, no un tick después.
        expect(peekImageFocus('http://srv/a.jpg')).toBe(focus);
    });

    it('color y encuadre a la vez decodifican la imagen una sola vez', async () => {
        const [analysis, focus] = await Promise.all([
            analyzeImage('http://srv/a.jpg'),
            imageFocus('http://srv/a.jpg')
        ]);
        expect(built, 'una sola descarga para los dos').toBe(1);
        expect(analysis.focusX).toBe(focus);
    });

    it('analizar el color deja el encuadre listo para el peek', async () => {
        await analyzeImage('http://srv/a.jpg');
        expect(peekImageFocus('http://srv/a.jpg')).not.toBeUndefined();
    });
});

// El encuadre se prueba sobre el búfer de píxeles y no a través del canvas:
// jsdom no pinta, así que `getContext` devuelve null y por ahí no se llega
// nunca al cálculo. La función es pura y recibe el array, que es justo la
// costura que hace falta.
describe('dynamicColor: encuadre', () => {
    const W = 100;
    const H = 60;

    /**
     * Lienzo liso con un bloque de detalle (un damero) entre dos columnas.
     * El damero es lo que genera energía de bordes; el resto es plano.
     */
    function withDetail(...blocks: [number, number][]): Uint8ClampedArray {
        const data = new Uint8ClampedArray(W * H * 4);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const inBlock = blocks.some(([from, to]) => x >= from && x < to);
                const v = inBlock && (x + y) % 2 === 0 ? 255 : 0;
                const i = (y * W + x) * 4;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
                data[i + 3] = 255;
            }
        }
        return data;
    }

    it('el detalle a la izquierda se lleva el encuadre a la izquierda', () => {
        const focus = focusFromPixels(withDetail([10, 30]), W, H);
        expect(focus).not.toBeNull();
        expect(focus).toBeLessThan(40);
    });

    it('el detalle a la derecha se lo lleva a la derecha', () => {
        const focus = focusFromPixels(withDetail([70, 90]), W, H);
        expect(focus).not.toBeNull();
        expect(focus).toBeGreaterThan(60);
    });

    it('con detalle repartido a los dos lados se queda en el centro', () => {
        const focus = focusFromPixels(withDetail([10, 25], [75, 90]), W, H);
        expect(focus).toBeGreaterThan(45);
        expect(focus).toBeLessThan(55);
    });

    it('una imagen plana no tiene nada que encuadrar', () => {
        // Es también el caso del canvas vacío de jsdom: sin energía, null, y
        // quien lo consume se queda en el 50% de siempre.
        expect(focusFromPixels(withDetail(), W, H)).toBeNull();
    });

    it('no se pega al borde aunque el detalle esté ahí', () => {
        // Un recorte pegado al canto se lee como un fallo de maquetación,
        // así que el encuadre se queda en el tope.
        expect(focusFromPixels(withDetail([0, 6]), W, H)).toBe(20);
        expect(focusFromPixels(withDetail([94, 100]), W, H)).toBe(80);
    });

    it('una imagen demasiado pequeña para tener vecinos no se mide', () => {
        expect(focusFromPixels(new Uint8ClampedArray(2 * 2 * 4), 2, 2)).toBeNull();
    });
});
