// El componente canónico de imagen (F2): una sola implementación de la carga
// (lazy + blurhash + fade-in) para todo el React de la app.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Image from './Image';

// userSettings arrastra la cadena legacy entera (apiclient, playbackmanager)
// al entorno de test; solo se necesitan estos dos flags.
vi.mock('../../scripts/settings/userSettings', () => ({
    enableFastFadein: () => true,
    enableBlurhash: () => true
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(ui: React.JSX.Element) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root?.render(ui); });
    return host;
}

describe('common/Image', () => {
    beforeEach(() => {
        // jsdom no trae IntersectionObserver y LazyLoadImage lo necesita para
        // decidir si pinta el <img>. Este doble lo declara visible en cuanto
        // se observa, que es el caso que interesa comprobar.
        class ImmediateObserver {
            constructor(private cb: IntersectionObserverCallback) {}
            observe(target: Element) {
                this.cb(
                    [{ target, isIntersecting: true } as IntersectionObserverEntry],
                    this as unknown as IntersectionObserver
                );
            }
            unobserve() { /* nada que hacer */ }
            disconnect() { /* nada que hacer */ }
            takeRecords() { return []; }
        }
        // La librería comprueba `'isIntersecting' in IntersectionObserverEntry
        // .prototype` antes de usar el observer, así que hace falta el par.
        class Entry {
            get isIntersecting() { return true; }
        }
        window.IntersectionObserver = ImmediateObserver as unknown as typeof IntersectionObserver;
        window.IntersectionObserverEntry = Entry as unknown as typeof IntersectionObserverEntry;
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });

    it('pinta la imagen con su URL', () => {
        const el = render(<Image imgUrl='http://s/img.jpg' />);
        expect(el.querySelector('img')?.getAttribute('src')).toBe('http://s/img.jpg');
    });

    it('por defecto es decorativa (alt vacío): la tarjeta ya lleva el título', () => {
        const el = render(<Image imgUrl='http://s/img.jpg' />);
        expect(el.querySelector('img')?.getAttribute('alt')).toBe('');
    });

    it('acepta un alt cuando la imagen sí aporta información', () => {
        const el = render(<Image imgUrl='http://s/img.jpg' alt='Portada de Dune' />);
        expect(el.querySelector('img')?.getAttribute('alt')).toBe('Portada de Dune');
    });

    it('containImage cambia el recorte a contain (logos, canales)', () => {
        const cover = render(<Image imgUrl='http://s/a.jpg' />);
        expect(cover.querySelector('img')?.style.objectFit).toBe('cover');

        act(() => { root?.unmount(); });
        host?.remove();

        const contain = render(<Image imgUrl='http://s/a.jpg' containImage />);
        expect(contain.querySelector('img')?.style.objectFit).toBe('contain');
    });

    it('layout fill se posiciona en absoluto sobre el contenedor', () => {
        const el = render(<Image imgUrl='http://s/a.jpg' />);
        expect(el.querySelector('img')?.style.position).toBe('absolute');
    });

    it('layout flow deja la imagen en el flujo normal (marcos con caja propia)', () => {
        const el = render(<Image imgUrl='http://s/a.jpg' layout='flow' />);
        expect(el.querySelector('img')?.style.position).toBe('');
    });

    it('arranca invisible: el fade-in entra al terminar la carga', () => {
        const el = render(<Image imgUrl='http://s/a.jpg' />);
        const img = el.querySelector('img');
        expect(img?.style.opacity).toBe('0');

        act(() => { img?.dispatchEvent(new Event('load')); });
        expect(el.querySelector('img')?.style.opacity).toBe('1');
    });
});
