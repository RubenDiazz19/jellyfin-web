import { useEffect, useState } from 'react';

// Posición vertical del scroll, throttled con requestAnimationFrame.
export function useScrollY(): number {
    const [y, setY] = useState(0);
    useEffect(() => {
        let raf = 0;
        const onScroll = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => setY(window.scrollY));
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onScroll);
        };
    }, []);
    return y;
}

/** True si window.scrollY supera el umbral. Solo re-renderiza al cruzar el umbral. */
export function useIsScrolled(threshold = 80): boolean {
    const [scrolled, setScrolled] = useState(() => (typeof window !== 'undefined' ? window.scrollY > threshold : false));
    useEffect(() => {
        let prev = window.scrollY > threshold;
        const onScroll = () => {
            const next = window.scrollY > threshold;
            if (next !== prev) {
                prev = next;
                setScrolled(next);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [threshold]);
    return scrolled;
}

export type NavScrollState = {
    /** True si window.scrollY supera el umbral. */
    isScrolled: boolean;
    /** True mientras el usuario se está desplazando activamente. */
    isScrolling: boolean;
};

/**
 * Detecta si la página se ha desplazado más allá del umbral y si el usuario
 * está en movimiento activo de scroll. Al detenerse durante `idleDelay` ms,
 * `isScrolling` vuelve a false.
 */
export function useNavScroll(threshold = 40, idleDelay = 350): NavScrollState {
    const [isScrolled, setIsScrolled] = useState(() => (typeof window !== 'undefined' ? window.scrollY > threshold : false));
    const [isScrolling, setIsScrolling] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        let prevScrolled = window.scrollY > threshold;

        const onScroll = () => {
            const currentY = window.scrollY;
            const nextScrolled = currentY > threshold;
            if (nextScrolled !== prevScrolled) {
                prevScrolled = nextScrolled;
                setIsScrolled(nextScrolled);
            }

            if (currentY > threshold) {
                setIsScrolling(true);
                if (idleTimer) clearTimeout(idleTimer);
                idleTimer = setTimeout(() => {
                    setIsScrolling(false);
                }, idleDelay);
            } else {
                if (idleTimer) clearTimeout(idleTimer);
                setIsScrolling(false);
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            if (idleTimer) clearTimeout(idleTimer);
            window.removeEventListener('scroll', onScroll);
        };
    }, [threshold, idleDelay]);

    return { isScrolled, isScrolling };
}

