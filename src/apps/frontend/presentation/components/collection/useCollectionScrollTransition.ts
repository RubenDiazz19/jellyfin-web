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
    /** Escala del logo, disminuye al subir. */
    logoScale: number;
    /** Opacidad del fondo. */
    backdropOpacity: number;
    /** Altura del contenedor de fondo (efecto recorte/header). */
    headerHeight: number;
    /** Desenfoque del fondo en píxeles. */
    backgroundBlur: number;
    /** Distancia desde arriba del viewport hasta la línea inferior del logo. */
    logoBottomFromTop: number;
    /** Pequeño zoom del fondo para dar efecto parallax. */
    backgroundScale: number;
    /** Si las tarjetas deben recibir interacción del puntero. */
    carouselInteractive: boolean;
    /** Función para deslizar suavemente hacia el contenido al hacer clic en el indicador. */
    scrollToContent: () => void;
};

/**
 * Hook para la transición cinematográfica de la colección vinculada al scroll (Scroll-driven).
 * - En reposo (scrollY = 0): Logo en el centro/abajo, indicador de scroll visible.
 * - Al hacer scroll: El logo asciende de forma coordinada y se encoge.
 *   El fondo se difumina y hace un pequeño zoom.
 *   El carrusel (u otras filas) emerge con fade-in y movimiento hacia arriba.
 * - Es 100% bidireccional.
 */
export function useCollectionScrollTransition(touch = false, onlyCollections = false): CollectionScrollTransition {
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

    // Altura del cabecero abarca siempre toda la pantalla
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 1000;
    const headerHeight = windowHeight;

    // El logo sube a la par que el scroll (-scrollY) hasta que llega a su tope
    // Asumimos que el logo empieza a `bottom: 365px` (o 285px en táctil).
    // Para que quede centrado en el cabecero final de 33vh, calculamos su recorrido máximo.
    // El usuario indicó que no quiere que suba "hasta arriba del todo", sino un poco más del 33% (1/3 de la pantalla).
    const initialBottom = touch ? 285 : (onlyCollections ? 505 : 365);
    const logoCenterYInitial = windowHeight - initialBottom;
    const logoCenterYFinal = (windowHeight / 3) - 50; // Sube unos píxeles más para quedar algo más cerca de la cabecera
    const maxLogoTravel = Math.max(0, logoCenterYInitial - logoCenterYFinal);

    // Limitamos el translateY al máximo recorrido
    const travelY = Math.min(scrollY, maxLogoTravel);
    const logoTranslateY = -travelY;

    // Escala del logo, no cambia (1)
    const logoScale = 1;

    // Progreso de 0 a 1 basado en el recorrido del logo
    const progress = Math.min(1, scrollY / (maxLogoTravel || 1));

    // El indicador de scroll se desvanece con los primeros compases del scroll
    const scrollHintOpacity = Math.max(0, Math.min(1, 1 - progress * 3.2));

    // El carrusel aparece progresivamente con desvanecimiento y desplazamiento ascendente
    const carouselProgress = Math.max(0, Math.min(1, (progress - 0.08) / 0.88));
    const carouselOpacity = carouselProgress;
    const carouselTranslateY = (1 - carouselProgress) * (touch ? 90 : 130);

    // Degradado translúcido tras el carrusel para asegurar contraste
    const gradientOpacity = Math.max(0, Math.min(1, progress * 1.15));

    // Posición exacta de la línea inferior del logo desde el top del viewport
    const logoBottomFromTop = windowHeight - (initialBottom + travelY);

    // Efectos sobre el fondo:
    // "En este punto (33vh), el fondo debe ser completamente negro" -> Opacidad decae hasta 0
    const backdropOpacity = Math.max(0, 1 - progress);
    const backgroundBlur = progress * 12; // Difuminado hasta 12px
    const backgroundScale = 1 + (progress * 0.05); // Zoom ligero

    const carouselInteractive = progress > 0.7;

    const scrollToContent = () => {
        window.scrollTo({ top: maxLogoTravel, behavior: 'smooth' });
    };

    return {
        scrollY,
        progress,
        logoTranslateY,
        logoScale,
        logoBottomFromTop,
        headerHeight,
        backgroundBlur,
        backgroundScale,
        scrollHintOpacity,
        carouselOpacity,
        carouselTranslateY,
        gradientOpacity,
        backdropOpacity,
        carouselInteractive,
        scrollToContent
    };
}
