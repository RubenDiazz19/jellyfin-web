import { describe, expect, test } from 'vitest';
import { fnv1a } from '../hash';

describe('fnv1a', () => {
    test('produce hashes deterministas para las mismas cadenas', () => {
        expect(fnv1a('test-string')).toBe(fnv1a('test-string'));
        expect(fnv1a('')).toBe(2166136261);
    });

    test('produce hashes diferentes para cadenas distintas', () => {
        expect(fnv1a('string1')).not.toBe(fnv1a('string2'));
    });

    test('devuelve un entero sin signo de 32 bits', () => {
        const h = fnv1a('cualquier-cadena-larga-123456');
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(0xFFFFFFFF);
        expect(Number.isInteger(h)).toBe(true);
    });
});
