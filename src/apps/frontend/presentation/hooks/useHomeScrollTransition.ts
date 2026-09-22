// Hook para la transición cinemática y suave entre el Hero a pantalla completa
// y la biblioteca de series/películas en la Home.
//
// Calcula la progresión normalizada del scroll (0 = Hero completo, 1 = Biblioteca
// completa) y deriva valores fluidos de opacidad, traslación y visibilidad
// mediante requestAnimationFrame para un rendimiento óptimo a 60/120 fps.

import { useEffect, useState } from 'react';

export type HomeScrollTransition = {
    /** Posición vertical actual del scroll en píxeles. */
    scrollY: number;
    /** Progresión normalizada entre 0 (Hero visible) y 1 (Biblioteca visible). */
    progress: number;
    /** Opacidad del contenido del Hero (título, logo, play, dots). */
    heroContentOpacity: number;
    /** Desplazamiento vertical del contenido del Hero al desvanecerse. */
    heroContentTranslateY: number;
    /** Opacidad del fondo/Backdrop del Hero. */
    heroBackdropOpacity: number;
    /** Escala sutil del fondo del Hero durante la transición. */
    heroBackdropScale: number;
    /** Opacidad del indicador de desplazamiento (ScrollHint). */
    scrollHintOpacity: number;
    /** Opacidad de las cabeceras de sección ("Series", "Películas", etc.). */
    titleOpacity: number;
    /** Desplazamiento vertical de las cabeceras de sección al aparecer. */
    titleTranslateY: number;
    /** Si los controles del Hero deben recibir eventos del puntero. */
    heroInteractive: boolean;
    /** Si el Hero está suficientemente fuera de vista como para pausar el autoplay. */
    isHeroOffscreen: boolean;
};

export function useHomeScrollTransition(): HomeScrollTransition {
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

    // Umbral de transición: cubre la altura de la pantalla completa
    // tanto en móvil como en escritorio.
    const threshold = typeof window !== 'undefined' ?
        Math.max(window.innerHeight * 0.9, 600) :
        600;

    const progress = Math.max(0, Math.min(1, scrollY / (threshold || 1)));

    // El contenido del hero (título, logo, botón play) se desvanece en los
    // primeros compases del scroll para despejar el espacio a las tarjetas.
    const heroContentOpacity = Math.max(0, Math.min(1, 1 - progress * 2.2));
    const heroContentTranslateY = 0;

    // El fondo (backdrop) permanece 100% visible al principio mientras las
    // tarjetas emergen sobre la imagen sin fondo negro; a partir del ~25%
    // de recorrido se va difuminando progresivamente a negro hasta que las
    // tarjetas cubren la pantalla completa.
    const backdropFade = progress <= 0.25 ? 0 : Math.min(1, (progress - 0.25) / 0.75);
    const heroBackdropOpacity = 1 - backdropFade;
    const heroBackdropScale = 1;

    // El aviso de scroll desaparece de inmediato al empezar a deslizar.
    const scrollHintOpacity = Math.max(0, Math.min(1, 1 - progress * 3.5));

    // Los títulos de las secciones ("Series", "Películas", "Continuar viendo")
    // van apareciendo conforme las tarjetas alcanzan su posición superior.
    const titleProgress = progress >= 0.95 ? 1 : Math.max(0, Math.min(1, (progress - 0.55) / 0.4));
    const titleOpacity = titleProgress;
    const titleTranslateY = (1 - titleProgress) * 10;

    const heroInteractive = progress < 0.35;
    const isHeroOffscreen = progress > 0.65;

    return {
        scrollY,
        progress,
        heroContentOpacity,
        heroContentTranslateY,
        heroBackdropOpacity,
        heroBackdropScale,
        scrollHintOpacity,
        titleOpacity,
        titleTranslateY,
        heroInteractive,
        isHeroOffscreen
    };
}
