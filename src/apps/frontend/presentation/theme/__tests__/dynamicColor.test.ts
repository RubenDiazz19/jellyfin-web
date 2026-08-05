// Memoización de la extracción de seed: sin tope, una sesión larga por la
// biblioteca acumulaba una entrada por imagen vista y no soltaba ninguna.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    analysisCacheSize, analyzeImage, focusFromPixels, resetAnalysisCache
} from '../dynamicColor';

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
