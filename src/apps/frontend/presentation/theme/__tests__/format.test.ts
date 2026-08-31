import { describe, expect, test } from 'vitest';
import {
    formatDateLong, formatEndTime, formatPlaybackEndTime, formatRemaining,
    formatRemainingCompact, formatRuntime, parseRuntimeMinutes
} from '../format';

describe('formatDateLong', () => {
    test('fecha larga en español', () => {
        expect(formatDateLong('2015-07-10T00:00:00Z')).toBe('10 de julio de 2015');
    });

    test('la segunda llamada sale del caché (mismo resultado)', () => {
        const a = formatDateLong('2020-01-05T00:00:00Z');
        const b = formatDateLong('2020-01-05T00:00:00Z');
        expect(a).toBe(b);
        expect(a).toBe('5 de enero de 2020');
    });

    test('sin fecha → cadena vacía', () => {
        expect(formatDateLong(undefined)).toBe('');
        expect(formatDateLong('')).toBe('');
    });
});

describe('formatRemainingCompact', () => {
    test('menos de una hora → solo minutos', () => {
        expect(formatRemainingCompact(1)).toBe('1 min');
        expect(formatRemainingCompact(42)).toBe('42 min');
        expect(formatRemainingCompact(59)).toBe('59 min');
    });

    test('a partir de 60 → horas y minutos', () => {
        expect(formatRemainingCompact(60)).toBe('1 h');
        expect(formatRemainingCompact(72)).toBe('1 h 12 min');
        expect(formatRemainingCompact(120)).toBe('2 h');
        expect(formatRemainingCompact(176)).toBe('2 h 56 min');
    });

    test('acepta strings (los slides guardan los minutos como texto)', () => {
        expect(formatRemainingCompact('47')).toBe('47 min');
        expect(formatRemainingCompact('90')).toBe('1 h 30 min');
    });

    test('entrada vacía o inválida → cadena vacía', () => {
        expect(formatRemainingCompact(undefined)).toBe('');
        expect(formatRemainingCompact('')).toBe('');
        expect(formatRemainingCompact(0)).toBe('');
        expect(formatRemainingCompact('n/a')).toBe('');
    });
});

describe('formatRemaining', () => {
    test('formato largo con sufijo por defecto', () => {
        expect(formatRemaining(45)).toBe('45 minutos restantes');
        expect(formatRemaining(80)).toBe('1 hora y 20 minutos restantes');
    });
});

describe('formatRuntime', () => {
    test('convierte "min" simples a horas', () => {
        expect(formatRuntime('45 min')).toBe('45 min');
        expect(formatRuntime('176 min')).toBe('2 h 56 min');
    });

    test('valores no simples se devuelven tal cual', () => {
        expect(formatRuntime('47–51 min')).toBe('47–51 min');
    });
});

describe('parseRuntimeMinutes', () => {
    test('extrae minutos desde números', () => {
        expect(parseRuntimeMinutes(70)).toBe(70);
        expect(parseRuntimeMinutes(45)).toBe(45);
    });

    test('extrae minutos desde cadenas simples', () => {
        expect(parseRuntimeMinutes('70 min')).toBe(70);
        expect(parseRuntimeMinutes('176 min')).toBe(176);
        expect(parseRuntimeMinutes('45')).toBe(45);
    });

    test('extrae minutos desde formatos en horas y minutos', () => {
        expect(parseRuntimeMinutes('1 h 10 min')).toBe(70);
        expect(parseRuntimeMinutes('2 h 56 min')).toBe(176);
        expect(parseRuntimeMinutes('2 h')).toBe(120);
    });

    test('valores no válidos devuelven undefined', () => {
        expect(parseRuntimeMinutes(undefined)).toBeUndefined();
        expect(parseRuntimeMinutes('')).toBeUndefined();
        expect(parseRuntimeMinutes('—')).toBeUndefined();
        expect(parseRuntimeMinutes(0)).toBeUndefined();
    });
});

describe('formatEndTime', () => {
    test('calcula correctamente la hora de fin sumando la duración', () => {
        const baseDate = new Date('2026-08-31T10:00:00');
        const endTime = formatEndTime(70, baseDate);
        expect(endTime).toBeDefined();
        // Contiene la hora 11:10 (10:00 + 70 min)
        expect(endTime).toMatch(/11:10/);
    });

    test('devuelve undefined si no hay duración válida', () => {
        expect(formatEndTime(undefined)).toBeUndefined();
        expect(formatEndTime('—')).toBeUndefined();
    });
});

describe('formatPlaybackEndTime', () => {
    test('calcula correctamente la hora de fin sumando los segundos restantes a velocidad 1x', () => {
        const baseDate = new Date('2026-08-31T10:00:00');
        // 70 minutos = 4200 segundos
        const endTime = formatPlaybackEndTime(4200, 1, baseDate);
        expect(endTime).toBeDefined();
        expect(endTime).toMatch(/11:10/);
    });

    test('ajusta la hora si la velocidad de reproducción es mayor', () => {
        const baseDate = new Date('2026-08-31T10:00:00');
        // 70 minutos a 2x = 35 minutos de tiempo real (10:35)
        const endTime = formatPlaybackEndTime(4200, 2, baseDate);
        expect(endTime).toBeDefined();
        expect(endTime).toMatch(/10:35/);
    });

    test('devuelve undefined si los segundos restantes son 0 o negativos', () => {
        expect(formatPlaybackEndTime(0)).toBeUndefined();
        expect(formatPlaybackEndTime(-10)).toBeUndefined();
        expect(formatPlaybackEndTime(undefined)).toBeUndefined();
    });
});

