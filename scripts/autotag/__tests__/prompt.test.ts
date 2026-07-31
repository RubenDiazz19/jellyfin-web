// El prompt es la única defensa contra el texto libre: si el vocabulario no
// llega entero, el modelo se inventa etiquetas y el filtro vuelve a ser una
// tira infinita, solo que en castellano.

import { describe, expect, test } from 'vitest';
import { VOCABULARY_TAGS } from '../../../src/apps/frontend/data/autotag/vocabulary';
import { buildSystemPrompt, buildUserPrompt, type PromptItem } from '../prompt';

const item = (over: Partial<PromptItem> = {}): PromptItem => ({
    id: 'abc',
    kind: 'Película',
    title: 'Coherence',
    year: 2013,
    genres: ['Ciencia ficción'],
    keywords: ['quantum physics'],
    overview: 'Ocho amigos cenan la noche que pasa un cometa.',
    ...over
});

describe('buildSystemPrompt', () => {
    const prompt = buildSystemPrompt();

    test('enumera todas las etiquetas del vocabulario', () => {
        const faltan = VOCABULARY_TAGS.filter((tag) => !prompt.includes(tag));
        expect(faltan).toEqual([]);
    });

    test('deja claro que la lista es cerrada', () => {
        expect(prompt).toMatch(/lista cerrada/i);
        expect(prompt).toMatch(/no inventes/i);
    });

    test('permite explícitamente no etiquetar', () => {
        // Sin esto un modelo siempre devuelve el máximo de etiquetas, aunque
        // no venga a cuento.
        expect(prompt).toMatch(/lista vacía/i);
    });
});

describe('buildUserPrompt', () => {
    test('incluye número, título y sinopsis de cada item', () => {
        const prompt = buildUserPrompt([item()]);
        expect(prompt).toContain('n: 1');
        expect(prompt).toContain('Coherence (2013)');
        expect(prompt).toContain('Ocho amigos');
    });

    test('NO manda el id real: el modelo lo copiaba mal y perdía el título', () => {
        expect(buildUserPrompt([item()])).not.toContain('abc');
    });

    test('numera desde 1 y correlativo', () => {
        const prompt = buildUserPrompt([item(), item({ id: 'def' }), item({ id: 'ghi' })]);
        expect(prompt).toContain('n: 1');
        expect(prompt).toContain('n: 2');
        expect(prompt).toContain('n: 3');
    });

    test('recorta las sinopsis largas', () => {
        const prompt = buildUserPrompt([item({ overview: 'x'.repeat(2000) })]);
        expect(prompt).toContain('…');
        expect(prompt.length).toBeLessThan(1200);
    });

    test('marca los títulos sin sinopsis en vez de dejar el campo vacío', () => {
        expect(buildUserPrompt([item({ overview: '' })])).toContain('(sin sinopsis)');
    });

    test('omite géneros y keywords cuando no hay', () => {
        const prompt = buildUserPrompt([item({ genres: [], keywords: [] })]);
        expect(prompt).not.toContain('géneros:');
        expect(prompt).not.toContain('keywords:');
    });

    test('separa los items del lote', () => {
        const prompt = buildUserPrompt([item(), item({ id: 'def', title: 'Primer' })]);
        expect(prompt).toContain('Coherence');
        expect(prompt).toContain('Primer');
        expect(prompt).toContain('2 títulos');
    });
});
