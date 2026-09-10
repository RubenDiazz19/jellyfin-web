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
