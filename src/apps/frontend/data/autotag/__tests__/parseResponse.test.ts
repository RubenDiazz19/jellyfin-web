// Validación de la respuesta del modelo. Todo lo que se prueba aquí son cosas
// que un LLM hace de verdad pese a pedirle JSON y vocabulario cerrado.

import { describe, expect, test } from 'vitest';
import { parseTagResponse } from '../parseResponse';
import { MAX_TAGS_PER_ITEM } from '../vocabulary';

const ok = (results: unknown) => JSON.stringify({ results });

describe('parseTagResponse', () => {
    test('extrae las etiquetas del formato pedido', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Anime', 'Venganza'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Anime', 'Venganza']);
    });

    test('acepta el mapa plano al que derivan algunos modelos', () => {
        const r = parseTagResponse(JSON.stringify({ 1: ['Western'] }), ['a']);
        expect(r.tags.get('a')).toEqual(['Western']);
    });

    test('quita el envoltorio ```json que llega pese al modo JSON', () => {
        const r = parseTagResponse('```json\n{"results":[{"n":1,"tags":["Bélico"]}]}\n```', ['a']);
        expect(r.tags.get('a')).toEqual(['Bélico']);
    });

    test('ignora el texto que algunos modelos ponen alrededor', () => {
        const raw = `Aquí tienes el resultado:\n${ok([{ n: 1, tags: ['Musical'] }])}\nEspero que ayude.`;
        expect(parseTagResponse(raw, ['a']).tags.get('a')).toEqual(['Musical']);
    });

    test('descarta las etiquetas inventadas y las reporta', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Anime', 'Cyberpunk noir'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Anime']);
        expect(r.rejectedTags).toEqual(['Cyberpunk noir']);
    });

    test('normaliza la grafía a la del vocabulario', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['anime', '  ZOMBIS '] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Anime', 'Zombis']);
    });

    test('deduplica cuando repite la misma etiqueta con otra grafía', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Anime', 'anime'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Anime']);
    });

    test('un item sin etiquetas reconocibles no se guarda', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Chorrada'] }]), ['a']);
        expect(r.tags.has('a')).toBe(false);
        expect(r.missingIds).toEqual(['a']);
    });

    test('descarta los números que no estaban en el lote', () => {
        const r = parseTagResponse(ok([{ n: 99, tags: ['Anime'] }]), ['a']);
        expect(r.tags.size).toBe(0);
        expect(r.strayRefs).toEqual([99]);
    });

    test('rechaza el 0: los títulos se numeran desde 1', () => {
        const r = parseTagResponse(ok([{ n: 0, tags: ['Anime'] }]), ['a']);
        expect(r.tags.size).toBe(0);
        expect(r.strayRefs).toEqual([0]);
    });

    test('asigna cada número a su título, no al primero', () => {
        const r = parseTagResponse(
            ok([{ n: 2, tags: ['Western'] }, { n: 1, tags: ['Anime'] }]),
            ['a', 'b']
        );
        expect(r.tags.get('a')).toEqual(['Anime']);
        expect(r.tags.get('b')).toEqual(['Western']);
    });

    test('acepta el número como cadena', () => {
        const r = parseTagResponse(ok([{ n: '2', tags: ['Western'] }]), ['a', 'b']);
        expect(r.tags.get('b')).toEqual(['Western']);
    });

    test('quita «Animación» cuando ya está «Anime»: una implica la otra', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Anime', 'Animación', 'Drama'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Anime', 'Drama']);
    });

    test('«Animación» sola se conserva: no es redundante sin «Anime»', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Animación', 'Familiar'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Animación', 'Familiar']);
    });

    test('la redundante no gasta plaza del tope', () => {
        const tags = ['Anime', 'Animación', 'Drama', 'Romance', 'Instituto', 'Feelgood'];
        // Sin quitar «Animación» antes de recortar, «Feelgood» se caería.
        expect(parseTagResponse(ok([{ n: 1, tags }]), ['a']).tags.get('a'))
            .toEqual(['Anime', 'Drama', 'Romance', 'Instituto', 'Feelgood']);
    });

    test('recorta al máximo por item', () => {
        const many = ['Anime', 'Venganza', 'Western', 'Bélico', 'Musical', 'Prisión', 'Terror'];
        expect(parseTagResponse(ok([{ n: 1, tags: many }]), ['a']).tags.get('a'))
            .toHaveLength(MAX_TAGS_PER_ITEM);
    });

    test('avisa de los ids del lote sobre los que no dijo nada', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Anime'] }]), ['a', 'b']);
        expect(r.missingIds).toEqual(['b']);
    });

    test('lanza con mensaje útil si no es JSON', () => {
        expect(() => parseTagResponse('no puedo ayudarte con eso', ['a']))
            .toThrow(/no devolvió JSON válido/);
    });

    test('tolera tipos raros dentro del array de etiquetas', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: [null, 42, 'Anime'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Anime']);
    });
});
