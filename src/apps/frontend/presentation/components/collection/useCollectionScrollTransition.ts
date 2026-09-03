import { useEffect, useState } from 'react';

export type CollectionScrollTransition = {
    /** Posición vertical actual del scroll en píxeles. */
    scrollY: number;
    /** Progresión normalizada de la transición entre 0 (estado inicial arriba) y 1 (carrusel visible). */
    progress: number;
    /** Desplazamiento vertical ascendente del logo durante el scroll. */
    logoTranslateY: number;
    /** Opacidad del indicador de flechas animadas bajo el logo. */
    scrollHintOpacity: number;
    /** Opacidad del carrusel de tarjetas. */
    carouselOpacity: number;
    /** Desplazamiento vertical del carrusel (entra de abajo hacia arriba). */
    carouselTranslateY: number;
    /** Opacidad del degradado negro translúcido de fondo para contraste. */
    gradientOpacity: number;
    /** Si las tarjetas deben recibir interacción del puntero. */
    carouselInteractive: boolean;
    /** Función para deslizar suavemente hacia el contenido al hacer clic en el indicador. */
    scrollToContent: () => void;
};

/**
 * Hook para la transición cinematográfica de la colección vinculada al scroll (Scroll-driven).
 * - En reposo (scrollY = 0): Logo en la parte inferior, indicador de scroll visible, carrusel oculto.
 * - Al hacer scroll: El logo asciende de forma coordinada, el carrusel emerge con fade-in y movimiento
 *   hacia arriba, y se genera un degradado negro translúcido de contraste sobre el fondo.
 * - Es 100% bidireccional: al hacer scroll up regresa exactamente a la posición inicial.
 */
export function useCollectionScrollTransition(touch = false): CollectionScrollTransition {
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        let raf = 0;
        const onScroll = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => setScrollY(window.scrollY));
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    // Umbral de scroll para completar la transición de forma natural y ágil (~360-420px)
    const threshold = typeof window !== 'undefined' ?
        Math.max(window.innerHeight * 0.52, 360) :
        380;

    const progress = Math.max(0, Math.min(1, scrollY / (threshold || 1)));

    // El indicador de scroll se desvanece con los primeros compases del scroll
    const scrollHintOpacity = Math.max(0, Math.min(1, 1 - progress * 3.2));

    // El carrusel aparece progresivamente con desvanecimiento y desplazamiento ascendente
    const carouselProgress = Math.max(0, Math.min(1, (progress - 0.08) / 0.88));
    const carouselOpacity = carouselProgress;
    const carouselTranslateY = (1 - carouselProgress) * (touch ? 90 : 130);

    // Degradado translúcido tras el carrusel para asegurar contraste
    const gradientOpacity = Math.max(0, Math.min(1, progress * 1.15));

    // Distancia vertical que recorre el logo hacia arriba de forma coordinada
    const travelDistance = typeof window !== 'undefined' ?
        Math.min(window.innerHeight * 0.44, touch ? 270 : 330) :
        (touch ? 260 : 320);
    const logoTranslateY = progress === 0 ? 0 : -progress * travelDistance;

    const carouselInteractive = progress > 0.7;

    const scrollToContent = () => {
        window.scrollTo({ top: threshold, behavior: 'smooth' });
    };

    return {
        scrollY,
        progress,
        logoTranslateY,
        scrollHintOpacity,
        carouselOpacity,
        carouselTranslateY,
        gradientOpacity,
        carouselInteractive,
        scrollToContent
    };
}
