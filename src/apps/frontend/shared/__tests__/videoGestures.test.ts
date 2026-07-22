import { describe, expect, it } from 'vitest';

import {
    classifySwipe,
    clamp01,
    gestureZone,
    pinchScale,
    seekDeltaFromDrag,
    SEEK_RANGE_SECONDS,
    touchDistance,
    verticalControl,
    verticalDelta
} from '../videoGestures';

describe('videoGestures · zonas', () => {
    it('divide el ancho en tercios', () => {
        expect(gestureZone(50, 300)).toBe('left');
        expect(gestureZone(150, 300)).toBe('center');
        expect(gestureZone(250, 300)).toBe('right');
    });

    it('ancho 0 cae a centro (sin dividir por cero)', () => {
        expect(gestureZone(10, 0)).toBe('center');
    });

    it('mitad izquierda = brillo, derecha = volumen', () => {
        expect(verticalControl(40, 200)).toBe('brightness');
        expect(verticalControl(160, 200)).toBe('volume');
    });
});

describe('videoGestures · clasificación de swipe', () => {
    it('por debajo del umbral no es swipe', () => {
        expect(classifySwipe(5, 5)).toBe('none');
    });

    it('predomina el eje de mayor desplazamiento', () => {
        expect(classifySwipe(60, 10)).toBe('horizontal');
        expect(classifySwipe(10, 60)).toBe('vertical');
    });

    it('empate horizontal/vertical resuelve a horizontal', () => {
        expect(classifySwipe(40, 40)).toBe('horizontal');
    });
});

describe('videoGestures · seek horizontal', () => {
    it('arrastre de ancho completo cubre SEEK_RANGE_SECONDS', () => {
        expect(seekDeltaFromDrag(300, 300)).toBeCloseTo(SEEK_RANGE_SECONDS);
        expect(seekDeltaFromDrag(-150, 300)).toBeCloseTo(-SEEK_RANGE_SECONDS / 2);
    });

    it('ancho 0 no produce delta', () => {
        expect(seekDeltaFromDrag(100, 0)).toBe(0);
    });
});

describe('videoGestures · control vertical', () => {
    it('arrastrar hacia arriba incrementa; hacia abajo decrementa', () => {
        // dy negativo = hacia arriba.
        expect(verticalDelta(-300, 500)).toBeGreaterThan(0);
        expect(verticalDelta(300, 500)).toBeLessThan(0);
    });

    it('recorrido ~60% del alto llega a 1.0', () => {
        expect(verticalDelta(-0.6 * 500, 500)).toBeCloseTo(1);
    });

    it('clamp01 acota a [0,1]', () => {
        expect(clamp01(1.5)).toBe(1);
        expect(clamp01(-0.2)).toBe(0);
        expect(clamp01(0.4)).toBe(0.4);
    });
});

describe('videoGestures · pinch', () => {
    it('escala = distancia actual / inicial', () => {
        expect(pinchScale(100, 150)).toBeCloseTo(1.5);
        expect(pinchScale(0, 150)).toBe(1);
    });

    it('touchDistance es la distancia euclídea', () => {
        expect(touchDistance(
            { clientX: 0, clientY: 0 },
            { clientX: 3, clientY: 4 }
        )).toBe(5);
    });
});
