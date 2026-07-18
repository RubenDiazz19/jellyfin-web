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
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return y;
}
