// Memoización de la extracción de seed: sin tope, una sesión larga por la
// biblioteca acumulaba una entrada por imagen vista y no soltaba ninguna.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetSeedCache, seedCacheSize, seedFromImage } from '../dynamicColor';

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
        resetSeedCache();
        vi.stubGlobal('Image', FakeImage);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        resetSeedCache();
    });

    it('memoiza por URL: la segunda vez no vuelve a decodificar', async () => {
        await seedFromImage('http://srv/a.jpg');
        await seedFromImage('http://srv/a.jpg');
        expect(built).toBe(1);
        expect(seedCacheSize()).toBe(1);
    });

    it('no crece sin límite: se queda en el tope', async () => {
        for (let i = 0; i < 60; i++) await seedFromImage(`http://srv/${i}.jpg`);
        expect(seedCacheSize()).toBe(50);
    });

    it('desaloja la menos usada, no la más antigua a secas', async () => {
        for (let i = 0; i < 50; i++) await seedFromImage(`http://srv/${i}.jpg`);
        built = 0;

        // Un acierto en la más vieja la vuelve la más reciente…
        await seedFromImage('http://srv/0.jpg');
        expect(built).toBe(0);

        // …así que al meter una nueva, la desalojada es la 1, no la 0.
        await seedFromImage('http://srv/nueva.jpg');
        expect(seedCacheSize()).toBe(50);

        built = 0;
        await seedFromImage('http://srv/0.jpg');
        expect(built, 'la 0 seguía en caché').toBe(0);
        await seedFromImage('http://srv/1.jpg');
        expect(built, 'la 1 fue la desalojada').toBe(1);
    });
});
