import { useCallback, type MouseEvent } from 'react';

/**
 * Previene la pérdida de foco del elemento activo, la selección indeseada de texto
 * o el inicio de drag and drop en elementos interactivos como botones o píldoras.
 */
export function preventMouseDown(e: MouseEvent): void {
    e.preventDefault();
}

/**
 * Devuelve un manejador estable para `onMouseDown` que previene el comportamiento por defecto.
 *
 * Puede usarse directamente como prop:
 * `<button onMouseDown={useStableClick()} onClick={...}>`
 * o usando la función pura:
 * `<button onMouseDown={preventMouseDown} onClick={...}>`
 */
export function useStableClick(): (e: MouseEvent) => void {
    return useCallback(preventMouseDown, []);
}
