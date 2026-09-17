// Validación de la respuesta del modelo. Todo lo que se prueba aquí son cosas
// que un LLM hace de verdad pese a pedirle JSON y vocabulario cerrado.

import { describe, expect, test } from 'vitest';
import { parseTagResponse } from '../parseResponse';
import { MAX_TAGS_PER_ITEM } from '../vocabulary';

const ok = (results: unknown) => JSON.stringify({ results });

describe('parseTagResponse', () => {
    test('extrae las etiquetas del formato pedido', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Mafia', 'Venganza'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Mafia', 'Venganza']);
    });

    test('acepta el mapa plano al que derivan algunos modelos', () => {
        const r = parseTagResponse(JSON.stringify({ 1: ['Slasher'] }), ['a']);
        expect(r.tags.get('a')).toEqual(['Slasher']);
    });

    test('quita el envoltorio ```json que llega pese al modo JSON', () => {
        const r = parseTagResponse('```json\n{"results":[{"n":1,"tags":["Distopía"]}]}\n```', ['a']);
        expect(r.tags.get('a')).toEqual(['Distopía']);
    });

    test('ignora el texto que algunos modelos ponen alrededor', () => {
        const raw = `Aquí tienes el resultado:\n${ok([{ n: 1, tags: ['Prisión'] }])}\nEspero que ayude.`;
        expect(parseTagResponse(raw, ['a']).tags.get('a')).toEqual(['Prisión']);
    });

    test('descarta las etiquetas inventadas y las reporta', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Mafia', 'Cyberpunk noir'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Mafia']);
        expect(r.rejectedTags).toEqual(['Cyberpunk noir']);
    });

    test('normaliza la grafía a la del vocabulario', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['mafia', '  ZOMBIS '] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Mafia', 'Zombis']);
    });

    test('deduplica cuando repite la misma etiqueta con otra grafía', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Mafia', 'mafia'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Mafia']);
    });

    test('un item sin etiquetas reconocibles no se guarda', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Chorrada'] }]), ['a']);
        expect(r.tags.has('a')).toBe(false);
        expect(r.missingIds).toEqual(['a']);
    });

    test('descarta los números que no estaban en el lote', () => {
        const r = parseTagResponse(ok([{ n: 99, tags: ['Mafia'] }]), ['a']);
        expect(r.tags.size).toBe(0);
        expect(r.strayRefs).toEqual([99]);
    });

    test('rechaza el 0: los títulos se numeran desde 1', () => {
        const r = parseTagResponse(ok([{ n: 0, tags: ['Mafia'] }]), ['a']);
        expect(r.tags.size).toBe(0);
        expect(r.strayRefs).toEqual([0]);
    });

    test('asigna cada número a su título, no al primero', () => {
        const r = parseTagResponse(
            ok([{ n: 2, tags: ['Slasher'] }, { n: 1, tags: ['Mafia'] }]),
            ['a', 'b']
        );
        expect(r.tags.get('a')).toEqual(['Mafia']);
        expect(r.tags.get('b')).toEqual(['Slasher']);
    });

    test('acepta el número como cadena', () => {
        const r = parseTagResponse(ok([{ n: '2', tags: ['Slasher'] }]), ['a', 'b']);
        expect(r.tags.get('b')).toEqual(['Slasher']);
    });

    test('recorta al máximo por item', () => {
        const many = ['Mafia', 'Venganza', 'Slasher', 'Zombis', 'Prisión', 'Extraterrestres', 'Vampiros'];
        expect(parseTagResponse(ok([{ n: 1, tags: many }]), ['a']).tags.get('a'))
            .toHaveLength(MAX_TAGS_PER_ITEM);
    });

    test('avisa de los ids del lote sobre los que no dijo nada', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: ['Mafia'] }]), ['a', 'b']);
        expect(r.missingIds).toEqual(['b']);
    });

    test('lanza con mensaje útil si no es JSON', () => {
        expect(() => parseTagResponse('no puedo ayudarte con eso', ['a']))
            .toThrow(/no devolvió JSON válido/);
    });

    test('tolera tipos raros dentro del array de etiquetas', () => {
        const r = parseTagResponse(ok([{ n: 1, tags: [null, 42, 'Mafia'] }]), ['a']);
        expect(r.tags.get('a')).toEqual(['Mafia']);
    });
});
