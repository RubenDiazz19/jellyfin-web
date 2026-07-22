import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initAdaptiveLayout, resetAdaptiveLayout } from '../adaptiveLayout';

const html = () => document.documentElement.classList;

function setWidth(px: number) {
    Object.defineProperty(window, 'innerWidth', { value: px, configurable: true });
}

function resize(px: number) {
    setWidth(px);
    window.dispatchEvent(new Event('resize'));
}

describe('adaptiveLayout (activación por viewport)', () => {
    beforeEach(() => {
        document.documentElement.className = '';
        document.body.className = '';
    });

    afterEach(() => {
        resetAdaptiveLayout();
        document.documentElement.className = '';
        document.body.className = '';
    });

    it('frontend activo + móvil (<600): layout-mobile sin tablet, sin desktop', () => {
        document.documentElement.classList.add('layout-desktop');
        document.body.classList.add('jf-frontend-active');
        setWidth(390);

        initAdaptiveLayout();

        expect(html().contains('layout-mobile')).toBe(true);
        expect(html().contains('layout-tablet')).toBe(false);
        expect(html().contains('layout-desktop')).toBe(false);
    });

    it('frontend activo + tablet (600–1023): añade layout-tablet sobre mobile', () => {
        document.documentElement.classList.add('layout-desktop');
        document.body.classList.add('jf-frontend-active');
        setWidth(820); // iPad Air en vertical

        initAdaptiveLayout();

        expect(html().contains('layout-mobile')).toBe(true);
        expect(html().contains('layout-tablet')).toBe(true);
        expect(html().contains('layout-desktop')).toBe(false);
    });

    it('escritorio real (≥1024): no se toca, layout-desktop intacto', () => {
        document.documentElement.classList.add('layout-desktop');
        document.body.classList.add('jf-frontend-active');
        setWidth(1280);

        initAdaptiveLayout();

        expect(html().contains('layout-desktop')).toBe(true);
        expect(html().contains('layout-mobile')).toBe(false);
        expect(html().contains('layout-tablet')).toBe(false);
    });

    it('reacciona al redimensionar en caliente entre los tres modos', () => {
        document.documentElement.classList.add('layout-desktop');
        document.body.classList.add('jf-frontend-active');
        setWidth(1280);
        initAdaptiveLayout();
        expect(html().contains('layout-desktop')).toBe(true);

        resize(800);
        expect(html().contains('layout-tablet')).toBe(true);
        expect(html().contains('layout-desktop')).toBe(false);

        resize(390);
        expect(html().contains('layout-mobile')).toBe(true);
        expect(html().contains('layout-tablet')).toBe(false);

        resize(1400);
        expect(html().contains('layout-desktop')).toBe(true);
        expect(html().contains('layout-mobile')).toBe(false);
    });

    it('fuera del frontend (dashboard legacy): respeta la decisión UA de base', () => {
        document.documentElement.classList.add('layout-desktop');
        // Sin jf-frontend-active: estamos en el dashboard.
        setWidth(500);

        initAdaptiveLayout();

        expect(html().contains('layout-desktop')).toBe(true);
        expect(html().contains('layout-mobile')).toBe(false);
    });

    it('al entrar/salir del frontend (clase en body) reevalúa', () => {
        document.documentElement.classList.add('layout-desktop');
        setWidth(500);
        initAdaptiveLayout();
        expect(html().contains('layout-mobile')).toBe(false); // aún en legacy

        document.body.classList.add('jf-frontend-active');
        return Promise.resolve().then(() => new Promise((r) => setTimeout(r, 0))).then(() => {
            expect(html().contains('layout-mobile')).toBe(true);
            document.body.classList.remove('jf-frontend-active');
            return new Promise((r) => setTimeout(r, 0));
        }).then(() => {
            expect(html().contains('layout-desktop')).toBe(true);
            expect(html().contains('layout-mobile')).toBe(false);
        });
    });

    it('base móvil real (UA phone): al salir del frontend restaura layout-mobile', () => {
        document.documentElement.classList.add('layout-mobile');
        document.body.classList.add('jf-frontend-active');
        setWidth(390);
        initAdaptiveLayout();
        expect(html().contains('layout-mobile')).toBe(true);

        document.body.classList.remove('jf-frontend-active');
        return new Promise((r) => setTimeout(r, 0)).then(() => {
            // Fuera del frontend, un teléfono real sigue siendo layout-mobile.
            expect(html().contains('layout-mobile')).toBe(true);
            expect(html().contains('layout-desktop')).toBe(false);
        });
    });

    it('TV nunca se toca', () => {
        document.documentElement.classList.add('layout-tv');
        document.body.classList.add('jf-frontend-active');
        setWidth(500);

        initAdaptiveLayout();

        expect(html().contains('layout-tv')).toBe(true);
        expect(html().contains('layout-mobile')).toBe(false);
        expect(html().contains('layout-tablet')).toBe(false);
    });
});
