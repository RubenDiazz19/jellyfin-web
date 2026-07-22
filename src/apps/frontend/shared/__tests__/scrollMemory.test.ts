import { beforeEach, describe, expect, it } from 'vitest';

import { SCROLL_MEMORY } from '../scrollMemory';

describe('scrollMemory', () => {
    beforeEach(() => {
        SCROLL_MEMORY.clear();
    });

    it('recuerda la posición de los destinos de tab', () => {
        SCROLL_MEMORY.save('/series', 840);
        expect(SCROLL_MEMORY.get('/series')).toBe(840);
        expect(SCROLL_MEMORY.get('/movies')).toBe(0);
    });

    it('ignora rutas que no son tabs (las páginas de detalle entran arriba)', () => {
        SCROLL_MEMORY.save('/show/abc', 500);
        expect(SCROLL_MEMORY.get('/show/abc')).toBe(0);
    });

    it('acota valores negativos a 0', () => {
        SCROLL_MEMORY.save('/', -30);
        expect(SCROLL_MEMORY.get('/')).toBe(0);
    });
});
