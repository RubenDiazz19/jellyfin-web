// Lectura del modo de layout que layoutManager materializa como clases en
// <html> (layout-mobile / layout-desktop / layout-tv; layout-tablet queda
// reservado para cuando se separe tablet de móvil). Se lee el DOM en vez de
// importar el layoutManager legacy: cero dependencias del árbol antiguo y
// trivial de simular en tests.

export type MobileLayout = 'mobile' | 'tablet';

/** 'mobile' | 'tablet' si el layout activo es táctil; null en desktop/tv. */
export function currentMobileLayout(): MobileLayout | null {
    const cl = document.documentElement.classList;
    if (cl.contains('layout-tablet')) return 'tablet';
    if (cl.contains('layout-mobile')) return 'mobile';
    return null;
}

/**
 * Observa cambios de clase en <html> (layoutManager las reescribe al
 * cambiar de modo). Devuelve el cleanup.
 */
export function observeLayoutMode(onChange: () => void): () => void {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
    return () => observer.disconnect();
}
