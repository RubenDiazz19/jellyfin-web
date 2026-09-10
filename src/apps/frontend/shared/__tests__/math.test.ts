import { describe, expect, test } from 'vitest';
import { clamp } from '../math';

describe('clamp', () => {
    test('devuelve el valor cuando está dentro del rango', () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    test('restringe al límite inferior si el valor es menor', () => {
        expect(clamp(-5, 0, 10)).toBe(0);
    });

    test('restringe al límite superior si el valor es mayor', () => {
        expect(clamp(15, 0, 10)).toBe(10);
    });

    test('soporta límites negativos', () => {
        expect(clamp(-50, -30, 30)).toBe(-30);
        expect(clamp(50, -30, 30)).toBe(30);
        expect(clamp(0, -30, 30)).toBe(0);
    });
});
