// La red que le faltaba a JF_API_ROOTS.
//
// El fallo que este test impide siempre es el mismo: alguien añade una llamada
// a una raíz nueva de la API, funciona contra el backend directo, y con `bun
// start` el dev server contesta su propio index.html con un 200. Como no es un
// 404, `res.ok` es true y lo que se ve es un error de parseo de JSON a mucha
// distancia de la causa. Ha pasado con /Playlists, con /Collections y con las
// cuatro últimas raíces de la lista.
//
// Así que en vez de confiar en que nadie se despiste, se leen las rutas del
// código y se comprueba que estén cubiertas.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { JF_API_ROOTS, JF_PROXY_PATTERN } from './apiRoots';

const API_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), '../src/apps/frontend/data/api'
);

/**
 * Primer segmento de toda ruta absoluta que aparezca en un literal.
 *
 * Se exige mayúscula inicial para quedarse con los endpoints de Jellyfin y no
 * con las rutas de import (`./movies`, `../session/session`) ni con los trozos
 * de url en minúscula. Se le escapan las raíces que la app pide en minúscula,
 * pero esas son fijas y ya están en la lista con su comentario.
 */
const ENDPOINT_ROOT = /[`'"](\/[A-Z][A-Za-z0-9]*)(?=[/?`'"])/g;

/**
 * Raíces que no aparecen como literal en este código porque las construye el
 * SDK. Se enumeran a mano —no hay de dónde leerlas— y por eso van con el
 * fichero que las usa al lado, para poder comprobarlo.
 */
const VIA_SDK: Record<string, string> = {
    QuickConnect: 'quickConnect.ts'
};

function sourceFiles(): string[] {
    return fs.readdirSync(API_DIR)
        .filter((f) => f.endsWith('.ts'))
        .map((f) => path.join(API_DIR, f));
}

/** Las raíces que el frontend pide de verdad, sacadas del código. */
function rootsInUse(): Set<string> {
    const roots = new Set<string>();
    for (const file of sourceFiles()) {
        const source = fs.readFileSync(file, 'utf-8');
        for (const [, route] of source.matchAll(ENDPOINT_ROOT)) {
            roots.add(route.slice(1));
        }
    }
    for (const root of Object.keys(VIA_SDK)) roots.add(root);
    return roots;
}

describe('JF_API_ROOTS cubre lo que el frontend llama', () => {
    test('ninguna raíz usada se queda fuera del proxy del dev server', () => {
        const covered = new Set(JF_API_ROOTS);
        const missing = [...rootsInUse()].filter((r) => !covered.has(r)).sort();
        expect(missing, 'añádelas a scripts/apiRoots.ts').toEqual([]);
    });

    test('el escáner encuentra algo (si no, no estaría probando nada)', () => {
        // Sin esto el test de arriba pasaría también con un regex roto.
        expect(rootsInUse().size).toBeGreaterThan(8);
        expect(rootsInUse()).toContain('Items');
    });

    test('las raíces del SDK siguen usándose donde dice la nota', () => {
        for (const [root, file] of Object.entries(VIA_SDK)) {
            const source = fs.readFileSync(path.join(API_DIR, file), 'utf-8');
            expect(source.toLowerCase(), `${root} ya no se usa en ${file}`)
                .toContain(root.toLowerCase());
        }
    });
});

describe('JF_PROXY_PATTERN', () => {
    const matches = (url: string) => new RegExp(JF_PROXY_PATTERN).test(url);

    test('empareja la raíz con subruta', () => {
        expect(matches('/Search/Hints?searchTerm=x')).toBe(true);
        expect(matches('/QuickConnect/Initiate')).toBe(true);
    });

    test('empareja la raíz desnuda y la raíz con query', () => {
        // `POST /Playlists` y `POST /Collections?name=…` no llevan subruta.
        expect(matches('/Playlists')).toBe(true);
        expect(matches('/Collections?name=Cine')).toBe(true);
    });

    test('respeta las minúsculas del transcode de Jellyfin', () => {
        expect(matches('/videos/abc/master.m3u8')).toBe(true);
    });

    test('no se lleva por delante las rutas de la SPA', () => {
        // `/video` es una vista de la app; `/Videos` es la API. Una letra.
        expect(matches('/video?item=abc')).toBe(false);
        expect(matches('/search')).toBe(false);
    });
});
