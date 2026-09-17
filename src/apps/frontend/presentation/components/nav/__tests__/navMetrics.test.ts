import { describe, it, expect } from 'vitest';
import {
    navSpace,
    aboveNav,
    besideNav,
    NAV_HEIGHT,
    NAV_MARGIN,
    RAIL_WIDTH,
    RAIL_MARGIN,
    NAV_BOTTOM_VAR,
    NAV_LEFT_VAR
} from '../navMetrics';

describe('navMetrics', () => {
    it('define constantes geométricas de navegación coherentes', () => {
        expect(NAV_HEIGHT).toBe(48);
        expect(NAV_MARGIN).toBe(12);
        expect(RAIL_WIDTH).toBe(NAV_HEIGHT);
        expect(RAIL_MARGIN).toBe(12);
    });

    describe('navSpace', () => {
        it('calcula espacio para barra inferior flotante (isRail = false)', () => {
            const space = navSpace(false);
            expect(space.bottom).toBe('calc(72px + env(safe-area-inset-bottom, 0px))');
            expect(space.left).toBe('env(safe-area-inset-left, 0px)');
        });

        it('calcula espacio para rail vertical (isRail = true)', () => {
            const space = navSpace(true);
            expect(space.bottom).toBe('env(safe-area-inset-bottom, 0px)');
            expect(space.left).toBe('calc(72px + env(safe-area-inset-left, 0px))');
        });
    });

    describe('aboveNav y besideNav', () => {
        it('aboveNav calcula la posición por encima de la barra', () => {
            const css = aboveNav(16);
            expect(css).toContain(NAV_BOTTOM_VAR);
            expect(css).toContain('16px');
        });

        it('besideNav calcula la posición al lado del rail', () => {
            const css = besideNav(8);
            expect(css).toContain(NAV_LEFT_VAR);
            expect(css).toContain('8px');
        });
    });
});
