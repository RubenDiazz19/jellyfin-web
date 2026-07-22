// Smoke test de los artefactos PWA (Fase 8.1): el manifest cumple los
// requisitos de instalabilidad y el service worker mantiene sus invariantes
// (fetch handler presente, streams nunca interceptados, ciclo de vida).
// Son comprobaciones de texto deliberadamente laxas: protegen contra
// borrados accidentales, no contra refactors legítimos.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest corre desde la raíz del repo (scripts de package.json); bajo el
// transform de vite import.meta.url no es file:, así que se resuelve por cwd.
const manifest = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'src/manifest.json'), 'utf-8')
) as Record<string, unknown>;

const sw = fs.readFileSync(path.resolve(process.cwd(), 'src/serviceworker.js'), 'utf-8');

describe('manifest.json (instalabilidad)', () => {
    it('tiene los campos que exige la instalación PWA', () => {
        expect(manifest.name).toBeTruthy();
        expect(manifest.short_name).toBeTruthy();
        expect(manifest.start_url).toBeTruthy();
        expect(manifest.display).toBe('standalone');
        expect(manifest.id).toBeTruthy();
        expect(manifest.scope).toBeTruthy();
        expect(manifest.theme_color).toMatch(/^#/);
        expect(manifest.background_color).toMatch(/^#/);
    });

    it('incluye un icono de 512px (requisito de Lighthouse/instalación)', () => {
        const icons = manifest.icons as Array<{ sizes: string }>;
        expect(icons.length).toBeGreaterThanOrEqual(4);
        expect(icons.some((i) => i.sizes === '512x512')).toBe(true);
    });
});

describe('serviceworker.js (invariantes)', () => {
    it('mantiene el ciclo de vida y el fetch handler', () => {
        expect(sw).toContain("addEventListener('install'");
        expect(sw).toContain("addEventListener('activate'");
        expect(sw).toContain("addEventListener('fetch'");
        expect(sw).toContain('skipWaiting');
        expect(sw).toContain('clients.claim');
    });

    it('excluye los streams A/V de la caché', () => {
        expect(sw).toContain('isMediaStream');
        // Los patrones de exclusión de vídeo/audio siguen presentes.
        expect(sw).toMatch(/videos\|audio/);
        expect(sw).toContain('m3u8');
    });

    it('conserva las cuatro cachés con versión', () => {
        for (const name of ['jfp-shell-v', 'jfp-assets-v', 'jfp-images-v', 'jfp-api-v']) {
            expect(sw).toContain(name);
        }
    });

    it('conserva el handler legacy de notificaciones', () => {
        expect(sw).toContain("addEventListener('notificationclick'");
    });
});
