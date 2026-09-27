// Factoría de IntersectionObserver compartidos. Cada rootMargin distinto crea
// un solo observer, y todos los componentes que lo necesitan se registran y
// desregistran sin multiplicar las suscripciones al scroll.
//
// Resuelve la duplicación entre LazyCard (tarjetas) y LazySection (secciones):
// las dos montaban un singleton idéntico con WeakMap de listeners.

const observers = new Map<string, IntersectionObserver>();
const listeners = new WeakMap<Element, (visible: boolean) => void>();

/**
 * Devuelve un IntersectionObserver compartido para el rootMargin indicado.
 * Se crea una sola vez por rootMargin.
 */
export function getSharedObserver(rootMargin: string): IntersectionObserver {
    let io = observers.get(rootMargin);
    if (!io) {
        io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    listeners.get(entry.target)?.(entry.isIntersecting);
                }
            },
            { rootMargin }
        );
        observers.set(rootMargin, io);
    }
    return io;
}

/**
 * Registra un callback para un elemento en el observer compartido.
 * Devuelve una función de limpieza.
 */
export function observeElement(
    el: Element,
    rootMargin: string,
    callback: (visible: boolean) => void
): () => void {
    listeners.set(el, callback);
    const io = getSharedObserver(rootMargin);
    io.observe(el);
    return () => {
        io.unobserve(el);
        listeners.delete(el);
    };
}
