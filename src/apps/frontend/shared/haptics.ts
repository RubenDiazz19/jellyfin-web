// Haptic feedback (Fase 7) — SOLO mobile/tablet. En desktop es un no-op
// (ni siquiera existe navigator.vibrate en la mayoría). Se centraliza aquí
// para respetar la gate de layout desde un único sitio.

import { currentMobileLayout } from './layoutMode';

export type HapticPattern = 'tick' | 'select' | 'success' | 'warn';

// Patrones (ms). Cortos: los pensados para tacto discreto, no para molestar.
const PATTERNS: Record<HapticPattern, number | number[]> = {
    tick: 8,
    select: 12,
    success: [10, 40, 10],
    warn: [20, 60, 20]
};

/** Vibra si el dispositivo es táctil y soporta la API. Silencioso si no. */
export function haptic(pattern: HapticPattern = 'tick'): void {
    if (currentMobileLayout() === null) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
        // eslint-disable-next-line compat/compat -- guardado con el feature-detect de arriba; en iOS (sin soporte) no se llega aquí
        navigator.vibrate(PATTERNS[pattern]);
    } catch {
        // Algunos navegadores lanzan si la vibración está bloqueada por
        // política de permisos: se ignora, es puramente estético.
    }
}
