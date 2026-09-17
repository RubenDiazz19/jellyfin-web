import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FAVS } from '../favsStore';

describe('favsStore (FAVS)', () => {
    beforeEach(() => {
        localStorage.clear();
        FAVS._reset();
    });

    it('tiene el nombre de evento configurado', () => {
        expect(FAVS.event).toBe('jfp-favs-change');
    });

    it('añade y comprueba si un id es favorito', () => {
        expect(FAVS.has('item-1')).toBe(false);
        FAVS.add(['item-1']);
        expect(FAVS.has('item-1')).toBe(true);
    });

    it('elimina un id de favoritos', () => {
        FAVS.add(['item-1']);
        FAVS.remove(['item-1']);
        expect(FAVS.has('item-1')).toBe(false);
    });

    it('alterna el estado con toggle', () => {
        FAVS.toggle('item-2');
        expect(FAVS.has('item-2')).toBe(true);
        FAVS.toggle('item-2');
        expect(FAVS.has('item-2')).toBe(false);
    });

    it('devuelve todos los elementos con all()', () => {
        FAVS.add(['item-a', 'item-b']);
        expect(FAVS.all()).toEqual(expect.arrayContaining(['item-a', 'item-b']));
    });

    it('emite el evento de cambio global al mutar', () => {
        const spy = vi.fn();
        window.addEventListener(FAVS.event, spy);

        FAVS.toggle('item-3');
        expect(spy).toHaveBeenCalledTimes(1);

        FAVS.remove(['item-3']);
        expect(spy).toHaveBeenCalledTimes(2);

        window.removeEventListener(FAVS.event, spy);
    });

    it('setMany añade y quita en bloque', () => {
        FAVS.setMany(['x', 'y'], true);
        expect(FAVS.has('x')).toBe(true);
        expect(FAVS.has('y')).toBe(true);

        FAVS.setMany(['x'], false);
        expect(FAVS.has('x')).toBe(false);
        expect(FAVS.has('y')).toBe(true);
    });
});
