// `touch-action: manipulation` en lo interactivo (B3). Con el zoom del
// viewport ya permitido (A1), un doble tap rápido sobre una tarjeta lo
// interpretaría el navegador como zoom si el elemento no lo declara.
// La regla es CSS, así que se comprueba sobre el texto: sobre todo que cubra
// lo clicable y que NO se cuele en lo que gestiona su propio gesto.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Sin comentarios: si no, el texto que explica la regla cuenta como si fuera
// parte del selector (los comentarios de aquí nombran justo lo que se excluye).
const globalCss = fs
    .readFileSync(
        path.resolve(process.cwd(), 'src/apps/frontend/presentation/styles/global.css'),
        'utf-8'
    )
    .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Selectores (sin comentarios ni declaraciones) de las reglas que declaran
 * `touch-action: <value>`. Se filtran las líneas que abren selector para que
 * los comentarios del propio CSS no cuenten como coincidencia.
 */
function selectorsFor(value: string): string {
    return globalCss
        .split('}')
        .filter((chunk) => new RegExp(`touch-action:\\s*${value}\\s*;`).test(chunk))
        .flatMap((chunk) => chunk.split('\n'))
        .map((line) => line.trim())
        .filter((line) => line.endsWith(',') || line.endsWith('{'))
        .join('\n');
}

const manipulation = selectorsFor('manipulation');
const none = selectorsFor('none');

describe('touch-action: manipulation', () => {
    it('solo se aplica bajo layout mobile/tablet (desktop intacto)', () => {
        const lines = manipulation.split('\n').filter(Boolean);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
            expect(line).toMatch(/^html\.layout-(mobile|tablet)\b/);
        }
    });

    it('cubre botones, enlaces y los roles clicables', () => {
        for (const sel of ['button', 'a[href]', "[role='button']", "[role='tab']", "[role='menuitem']"]) {
            expect(manipulation).toContain(sel);
        }
    });

    it('cubre los controles de formulario que no son deslizantes', () => {
        expect(manipulation).toContain('select');
        expect(manipulation).toContain('label');
        expect(manipulation).toContain("input:not([type='range'])");
    });

    it('cubre las tarjetas clicables, que reciben taps fuera de su botón', () => {
        expect(manipulation).toContain('.jfp-card-m3');
        expect(manipulation).toContain('.jfp-hoverlift');
    });

    it('cubre la ruta /video, que se monta sin AppLayout', () => {
        // Sin esto los controles del OSD se quedaban fuera: el body de esa
        // ruta lleva jf-video-active, no jf-frontend-active.
        expect(manipulation).toContain('body.jf-video-active');
    });
});

describe('touch-action: lo que gestiona su propio gesto queda fuera', () => {
    it('no toca los input[type=range] (emby-slider)', () => {
        // El `:not` está justamente para eso: `manipulation` no rompería el
        // arrastre, pero sí conviene dejar el control al componente.
        expect(manipulation).not.toMatch(/input(?!:not)/);
    });

    it('no incluye [role=slider] (barra de progreso del reproductor)', () => {
        expect(manipulation).not.toContain("[role='slider']");
    });

    it('la capa de gestos y la barra de seek conservan touch-action: none', () => {
        expect(none).toContain('.jfp-video-gestures');
        expect(none).toContain('.jfp-video-progress');
    });
});
