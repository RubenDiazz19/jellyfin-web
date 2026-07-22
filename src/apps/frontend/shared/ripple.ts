// Ripple Material 3 (Fase 7) — SOLO mobile/tablet. Delegado: un único
// listener de pointerdown en el documento añade el "ink" a cualquier
// elemento opt-in con [data-ripple]. En desktop no se instala (initRipple
// sale pronto) y los data-ripple no tienen CSS asociado, así que el ratón no
// dispara nada.

import { currentMobileLayout } from './layoutMode';

const INK_CLASS = 'jfp-ripple-ink';

function spawnInk(target: HTMLElement, clientX: number, clientY: number): void {
    const rect = target.getBoundingClientRect();
    // Diámetro = lado mayor visible desde el punto de contacto (cubre la caja).
    const size = Math.max(rect.width, rect.height) * 2;
    const ink = document.createElement('span');
    ink.className = INK_CLASS;
    ink.style.width = `${size}px`;
    ink.style.height = `${size}px`;
    ink.style.left = `${clientX - rect.left - size / 2}px`;
    ink.style.top = `${clientY - rect.top - size / 2}px`;
    ink.addEventListener('animationend', () => ink.remove(), { once: true });
    target.appendChild(ink);
    // Red de seguridad por si el animationend no llega (elemento desmontado).
    setTimeout(() => ink.remove(), 700);
}

/**
 * Instala el ripple delegado. Devuelve el cleanup. En desktop no engancha
 * nada (pero devuelve un cleanup válido igualmente).
 */
export function initRipple(): () => void {
    const onDown = (e: PointerEvent) => {
        if (currentMobileLayout() === null) return;
        const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-ripple]');
        if (!target) return;
        spawnInk(target, e.clientX, e.clientY);
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
}
