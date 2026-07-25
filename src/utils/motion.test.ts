import { afterEach, describe, expect, it, vi } from 'vitest';

import { prefersReducedMotion, scrollBehavior } from './motion';

const realMatchMedia = window.matchMedia;

/** Simula la respuesta del sistema a `(prefers-reduced-motion: reduce)`. */
function mockReduce(reduce: boolean) {
    window.matchMedia = vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce') && reduce,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
    window.matchMedia = realMatchMedia;
});

describe('prefersReducedMotion', () => {
    it('es true cuando el sistema pide menos movimiento', () => {
        mockReduce(true);
        expect(prefersReducedMotion()).toBe(true);
    });

    it('es false cuando no hay preferencia', () => {
        mockReduce(false);
        expect(prefersReducedMotion()).toBe(false);
    });

    it('no revienta si el entorno no tiene matchMedia', () => {
        // @ts-expect-error se borra a propósito para simular el entorno pobre
        window.matchMedia = undefined;
        expect(prefersReducedMotion()).toBe(false);
    });

    it('se consulta en vivo (el usuario puede cambiarla con la app abierta)', () => {
        mockReduce(false);
        expect(prefersReducedMotion()).toBe(false);
        mockReduce(true);
        expect(prefersReducedMotion()).toBe(true);
    });
});

describe('scrollBehavior', () => {
    it('salta al destino con movimiento reducido', () => {
        mockReduce(true);
        expect(scrollBehavior()).toBe('auto');
    });

    it('mantiene el scroll suave por defecto', () => {
        mockReduce(false);
        expect(scrollBehavior()).toBe('smooth');
    });
});
