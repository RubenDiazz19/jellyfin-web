// Hook compartido de scroll para carruseles horizontales.
// Centraliza la detección de scroll (can-left / can-right) y la navegación
// programática que se repetía textualmente en CollectionCardCarousel y
// SubCollectionsCarousel.

import { useEffect, useRef, useState } from 'react';

export type CarouselScrollState = {
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    canScrollLeft: boolean;
    canScrollRight: boolean;
    scrollByAmount: (direction: 'left' | 'right') => void;
};

/**
 * Estado de scroll del carrusel: detecta si se puede ir a izquierda/derecha
 * y ofrece `scrollByAmount` para la navegación por flechas.
 *
 * @param deps — lista de dependencias que, al cambiar, recalculan el scroll
 *   (típicamente `[items]`).
 */
export function useCarouselScroll(deps: unknown[] = []): CarouselScrollState {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScrollButtons = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    };

    useEffect(() => {
        checkScrollButtons();
        const el = scrollContainerRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScrollButtons, { passive: true });
        window.addEventListener('resize', checkScrollButtons);
        return () => {
            el.removeEventListener('scroll', checkScrollButtons);
            window.removeEventListener('resize', checkScrollButtons);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    const scrollByAmount = (direction: 'left' | 'right') => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const amount = (el.clientWidth * 0.75) * (direction === 'left' ? -1 : 1);
        el.scrollBy({ left: amount, behavior: 'smooth' });
    };

    return { scrollContainerRef, canScrollLeft, canScrollRight, scrollByAmount };
}
