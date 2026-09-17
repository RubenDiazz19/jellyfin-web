import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { currentMobileLayout, observeLayoutMode } from '../layoutMode';

describe('layoutMode', () => {
    beforeEach(() => {
        document.documentElement.className = '';
    });

    afterEach(() => {
        document.documentElement.className = '';
    });

    describe('currentMobileLayout', () => {
        it('devuelve null si no tiene clases táctiles', () => {
            expect(currentMobileLayout()).toBeNull();
            document.documentElement.classList.add('layout-desktop');
            expect(currentMobileLayout()).toBeNull();
        });

        it('devuelve "mobile" si contiene layout-mobile', () => {
            document.documentElement.classList.add('layout-mobile');
            expect(currentMobileLayout()).toBe('mobile');
        });

        it('devuelve "tablet" si contiene layout-tablet', () => {
            document.documentElement.classList.add('layout-tablet');
            expect(currentMobileLayout()).toBe('tablet');
        });

        it('prioriza "tablet" si ambas clases están presentes', () => {
            document.documentElement.classList.add('layout-mobile', 'layout-tablet');
            expect(currentMobileLayout()).toBe('tablet');
        });
    });

    describe('observeLayoutMode', () => {
        it('notifica al cambiar la clase del documentElement y se desconecta con el cleanup', async () => {
            const onChange = vi.fn();
            const cleanup = observeLayoutMode(onChange);

            document.documentElement.classList.add('layout-mobile');

            // MutationObserver es asíncrono; esperamos una microtarea
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(onChange).toHaveBeenCalled();

            onChange.mockClear();
            cleanup();

            document.documentElement.classList.remove('layout-mobile');
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(onChange).not.toHaveBeenCalled();
        });
    });
});
