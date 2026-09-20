import { useState, useEffect } from 'react';
import { currentMobileLayout, observeLayoutMode } from '../../../shared/layoutMode';

/**
 * Detección de reproductor táctil. El reproductor se monta fuera de
 * AppLayout (sin MobileThemeProvider), así que el modo se lee de las clases
 * de <html> directamente. `portrait` alterna el OSD compacto/esencial.
 */
export function useTouchPlayback(): { touch: boolean; portrait: boolean } {
    const [touch, setTouch] = useState(() => currentMobileLayout() !== null);
    const [portrait, setPortrait] = useState(
        () => typeof window.matchMedia === 'function'
            && window.matchMedia('(orientation: portrait)').matches
    );

    useEffect(() => observeLayoutMode(() => setTouch(currentMobileLayout() !== null)), []);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(orientation: portrait)');
        const apply = () => setPortrait(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    return { touch, portrait };
}
