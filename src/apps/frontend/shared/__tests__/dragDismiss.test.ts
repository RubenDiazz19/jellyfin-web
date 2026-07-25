import { describe, expect, it } from 'vitest';

import {
    DISMISS_DISTANCE,
    DISMISS_VELOCITY,
    DRAG_THRESHOLD,
    dragVelocity,
    shouldDismiss
} from '../dragDismiss';

describe('dragDismiss · velocidad', () => {
    it('px/ms sobre el último tramo, en valor absoluto', () => {
        expect(dragVelocity(100, 200)).toBeCloseTo(0.5);
        expect(dragVelocity(-100, 200)).toBeCloseTo(0.5);
    });

    it('tiempo cero o negativo → 0 (sin dividir por cero)', () => {
        expect(dragVelocity(100, 0)).toBe(0);
        expect(dragVelocity(100, -5)).toBe(0);
    });
});

describe('dragDismiss · decisión de descarte', () => {
    it('descarta si el recorrido supera la distancia mínima', () => {
        expect(shouldDismiss(DISMISS_DISTANCE, 0)).toBe(true);
        expect(shouldDismiss(DISMISS_DISTANCE + 20, 0)).toBe(true);
    });

    it('no descarta con recorrido corto y sin velocidad', () => {
        expect(shouldDismiss(DISMISS_DISTANCE - 1, 0)).toBe(false);
        expect(shouldDismiss(10, 0)).toBe(false);
    });

    it('descarta por flick: velocidad alta con recorrido mínimo', () => {
        expect(shouldDismiss(DRAG_THRESHOLD * 2, DISMISS_VELOCITY)).toBe(true);
    });

    it('un flick que apenas se movió (roce) no descarta', () => {
        expect(shouldDismiss(DRAG_THRESHOLD, DISMISS_VELOCITY * 3)).toBe(false);
    });

    it('respeta una distancia mínima a medida (snackbars)', () => {
        expect(shouldDismiss(72, 0, 72)).toBe(true);
        expect(shouldDismiss(71, 0, 72)).toBe(false);
    });
});
