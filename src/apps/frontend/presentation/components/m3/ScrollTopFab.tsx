// FAB "volver arriba" para grids largos — SOLO mobile/tablet. Aparece al
// bajar más de un viewport y sube la página al pulsarlo. En desktop no se
// renderiza (el hover del ratón y la barra hacen menos necesario el atajo).

import { useEffect, useState } from 'react';

import { scrollBehavior } from 'utils/motion';

import { useResponsive } from '../../theme/responsive';
import { aboveNav } from '../nav/navMetrics';
import { Fab } from './Fab';

const SHOW_AFTER = 700;

function ArrowUp() {
    return (
        <svg width='22' height='22' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
            <path
                d='M12 19V6M6 11l6-6 6 6'
                stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'
            />
        </svg>
    );
}

export function ScrollTopFab() {
    const r = useResponsive();
    const [shown, setShown] = useState(false);

    useEffect(() => {
        if (!r.touch) return;
        const onScroll = () => setShown(window.scrollY > SHOW_AFTER);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [r.touch]);

    if (!r.touch || !shown) return null;

    return (
        <div style={{
            position: 'fixed',
            right: r.pagePad + 4,
            // Por encima de la píldora de navegación (móvil) o del rail
            // (tablet, que no ocupa la franja inferior).
            bottom: aboveNav(12),
            zIndex: 130,
            animation: 'jfp-fade-in 0.2s ease-out both'
        }}>
            <Fab
                icon={<ArrowUp />}
                ariaLabel='Volver arriba'
                onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
            />
        </div>
    );
}
