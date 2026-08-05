// El filtrado por ámbito de los eventos de store: lo que evita que marcar un
// episodio repinte las decenas de tarjetas de una rejilla.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WATCHED } from '../../../data/stores/watchedStore';
import { useStoreValue, useStoreVersion } from '../useStore';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    // En este orden: `_reset()` vuelca lo que quedara pendiente de escribir
    // (ver persistentStore) y el `clear()` posterior lo borra de verdad.
    WATCHED._reset();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
});

/** Cuenta los renders de un componente que observa `scope`. */
function mountVersionProbe(scope?: string) {
    let renders = 0;
    function Probe() {
        renders++;
        useStoreVersion(WATCHED.event, scope);
        return null;
    }
    act(() => { root.render(<Probe />); });
    const initial = renders;
    return { since: () => renders - initial };
}

describe('useStoreVersion con ámbito', () => {
    it('repinta cuando cambia un id de su rama', () => {
        const probe = mountVersionProbe('serie1');
        act(() => { WATCHED.setMany(['serie1-s1-e1'], true); });
        expect(probe.since()).toBe(1);
    });

    it('ignora los cambios de otras ramas', () => {
        const probe = mountVersionProbe('serie1');
        act(() => { WATCHED.setMany(['serie2-s1-e1', 'movie-x'], true); });
        expect(probe.since()).toBe(0);
    });

    it('el prefijo exige el separador: s1 no casa con s10', () => {
        const probe = mountVersionProbe('serie1-s1');
        act(() => { WATCHED.setMany(['serie1-s10-e1'], true); });
        expect(probe.since()).toBe(0);
        act(() => { WATCHED.setMany(['serie1-s1-e2'], true); });
        expect(probe.since()).toBe(1);
    });

    it('sin ámbito se repinta con cualquier cambio', () => {
        const probe = mountVersionProbe();
        act(() => { WATCHED.setMany(['loquesea'], true); });
        expect(probe.since()).toBe(1);
    });

    it('un evento sin detalle de ids se acepta siempre', () => {
        const probe = mountVersionProbe('serie1');
        act(() => { window.dispatchEvent(new Event(WATCHED.event)); });
        expect(probe.since()).toBe(1);
    });
});

describe('useStoreValue', () => {
    it('solo se re-lee si el cambio toca su clave', () => {
        const seen: boolean[] = [];
        function Probe() {
            const watched = useStoreValue(WATCHED.event, 'movie-1', () => WATCHED.has('movie-1'));
            seen.push(watched);
            return null;
        }
        act(() => { root.render(<Probe />); });
        seen.length = 0;

        act(() => { WATCHED.setMany(['movie-2'], true); });
        expect(seen).toEqual([]);

        act(() => { WATCHED.setMany(['movie-1'], true); });
        expect(seen.at(-1)).toBe(true);
    });
});

describe('detalle del evento', () => {
    it('lleva solo los ids que de verdad cambiaron', () => {
        WATCHED.setMany(['a', 'b'], true);
        let ids: readonly string[] | undefined;
        const spy = (e: Event) => {
            ids = (e as CustomEvent<{ ids?: readonly string[] }>).detail?.ids;
        };
        window.addEventListener(WATCHED.event, spy);
        // 'a' ya estaba marcado: solo 'c' cambia de lado.
        WATCHED.setMany(['a', 'c'], true);
        window.removeEventListener(WATCHED.event, spy);
        expect(ids).toEqual(['c']);
    });

    it('no emite nada si el cambio no altera el estado', () => {
        WATCHED.setMany(['a'], true);
        let calls = 0;
        const spy = () => { calls++; };
        window.addEventListener(WATCHED.event, spy);
        WATCHED.setMany(['a'], true);
        window.removeEventListener(WATCHED.event, spy);
        expect(calls).toBe(0);
    });
});
