// El theme-color sale de la definición del tema, no del CSS aplicado. Estos
// tests fijan justo eso: que la forma del objeto de MUI de la que se lee sigue
// siendo la esperada (si MUI mueve `colorSchemes[x].palette`, aquí se ve) y que
// un tema desconocido no deja la barra de estado con un valor vacío.

import { describe, expect, it } from 'vitest';

import { applyThemeColor, themeBackgroundColor } from '../themeColor';

/** Los temas que la app ofrece; deben tener todos un color de fondo. */
const THEME_IDS = ['appletv', 'blueradiance', 'dark', 'light', 'purplehaze', 'wmc'];

describe('themeColor', () => {
    it('cada tema declara un color de fondo', () => {
        for (const id of THEME_IDS) {
            const color = themeBackgroundColor(id);
            expect(color, `el tema "${id}" no expone palette.background.default`).toBeTruthy();
            expect(color).toMatch(/^(#|rgb)/);
        }
    });

    it('los temas claros y oscuros no coinciden en el color', () => {
        expect(themeBackgroundColor('light')).not.toBe(themeBackgroundColor('dark'));
    });

    it('un tema desconocido no existe', () => {
        expect(themeBackgroundColor('no-existe')).toBeUndefined();
    });

    describe('applyThemeColor', () => {
        function withMeta(content: string, fn: (meta: HTMLMetaElement) => void) {
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = content;
            document.head.appendChild(meta);
            try {
                fn(meta);
            } finally {
                meta.remove();
            }
        }

        it('escribe el color del tema en la etiqueta', () => {
            withMeta('#202020', (meta) => {
                const applied = applyThemeColor('light');
                expect(applied).toBe(themeBackgroundColor('light'));
                expect(meta.content).toBe(applied);
            });
        });

        it('un tema desconocido cae al fallback en vez de vaciar la etiqueta', () => {
            withMeta('#202020', (meta) => {
                expect(applyThemeColor('no-existe')).toBe('#101010');
                expect(meta.content).toBe('#101010');
            });
        });

        it('sin la etiqueta en la página no revienta', () => {
            expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
            expect(applyThemeColor('dark')).toBeNull();
        });
    });
});
