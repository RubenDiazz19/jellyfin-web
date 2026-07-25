// A11y — el usuario tiene que poder ampliar la interfaz (WCAG 1.4.4).
// Bloquear el zoom es una regresión fácil de reintroducir sin querer (basta
// con volver a poner `user-scalable=no` en el meta o llamar al viejo
// setUserScalable), así que se fija por test sobre el texto de los ficheros.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf-8');

const indexHtml = read('src/index.html');
const appHost = read('src/components/apphost.js');
const globalCss = read('src/apps/frontend/presentation/styles/global.css');

const VIEWPORT_META = /<meta\s+name="viewport"\s+content="([^"]*)"/;
const MAX_SCALE = /maximum-scale\s*=\s*([\d.]+)/;

/** Contenido del <meta name="viewport"> del documento principal. */
function viewportContent(html: string): string {
    const m = VIEWPORT_META.exec(html);
    if (!m) throw new Error('No hay <meta name="viewport"> en index.html');
    return m[1];
}

describe('viewport (zoom permitido)', () => {
    it('index.html no bloquea el zoom', () => {
        const content = viewportContent(indexHtml);
        expect(content).not.toMatch(/user-scalable\s*=\s*no/);
        expect(content).not.toMatch(/maximum-scale\s*=\s*1\b/);
    });

    it('index.html permite ampliar al menos 5x', () => {
        const max = MAX_SCALE.exec(viewportContent(indexHtml));
        // Sin maximum-scale el navegador no impone techo: también vale.
        if (max) expect(Number(max[1])).toBeGreaterThanOrEqual(5);
    });

    it('index.html conserva viewport-fit=cover (safe areas del layout móvil)', () => {
        expect(viewportContent(indexHtml)).toContain('viewport-fit=cover');
    });

    it('appHost.setUserScalable ya no puede desactivar el zoom', () => {
        // La función sigue existiendo (API pública para los shells nativos),
        // pero ninguna de sus ramas escribe user-scalable=no / maximum-scale=1.
        expect(appHost).toContain('setUserScalable');
        const body = appHost.slice(appHost.indexOf('setUserScalable'));
        const fn = body.slice(0, body.indexOf('screen:'));
        expect(fn).not.toMatch(/user-scalable\s*=\s*no/);
        expect(fn).not.toMatch(/maximum-scale=\$?\{?1[,}]/);
        expect(fn).toContain('viewport-fit=cover');
    });
});

describe('viewport (sin regresión de gestos)', () => {
    it('el retardo del doble-tap se evita con touch-action, no bloqueando el zoom', () => {
        expect(globalCss).toContain('touch-action: manipulation');
    });

    it('la capa de gestos del reproductor sigue capturando el gesto (touch-action: none)', () => {
        // Sin esto, al permitir zoom el doble-tap de ±10 s lo interceptaría el
        // navegador para hacer zoom.
        expect(globalCss).toContain('touch-action: none');
    });
});
