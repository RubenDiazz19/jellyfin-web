import { describe, expect, test } from 'vitest';
import { translateStatus } from '../status';

describe('translateStatus', () => {
    test('traduce estados de series en inglés al español', () => {
        expect(translateStatus('Continuing')).toBe('En emisión');
        expect(translateStatus('Ended')).toBe('Finalizada');
        expect(translateStatus('Upcoming')).toBe('Próximamente');
        expect(translateStatus('Unaired')).toBe('Próximamente');
        expect(translateStatus('In Production')).toBe('En producción');
        expect(translateStatus('Canceled')).toBe('Cancelada');
        expect(translateStatus('Cancelled')).toBe('Cancelada');
        expect(translateStatus('Pilot')).toBe('Piloto');
    });

    test('mantiene estados que ya están en español o no tienen traducción', () => {
        expect(translateStatus('En emisión')).toBe('En emisión');
        expect(translateStatus('Finalizada')).toBe('Finalizada');
        expect(translateStatus('Estado Desconocido')).toBe('Estado Desconocido');
    });

    test('tolera cadenas vacías o undefined', () => {
        expect(translateStatus('')).toBe('');
        expect(translateStatus(undefined)).toBe('');
        expect(translateStatus(null)).toBe('');
    });
});
