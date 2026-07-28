// Píldora "Sin conexión" (M3) — solo visible en mobile/tablet cuando el
// navegador pierde la red. En desktop no renderiza nunca (layout null).

import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { useMobileTheme } from '../../theme/MobileThemeProvider';

export function OfflineIndicator() {
    const { layout } = useMobileTheme();
    const [online, setOnline] = useState(() => navigator.onLine !== false);

    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }, []);

    if (!layout || online) return null;

    return (
        <div
            role='status'
            style={{
                position: 'fixed',
                top: 'calc(12px + env(safe-area-inset-top, 0px))',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 260,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 'var(--md-sys-shape-corner-full, 9999px)',
                background: 'var(--md-sys-color-error-container, #93000a)',
                color: 'var(--md-sys-color-on-error-container, #ffdad6)',
                boxShadow: 'var(--md-sys-elevation-level2, 0 2px 6px rgba(0,0,0,0.4))',
                fontSize: 'var(--md-sys-typescale-label-large-size, 14px)',
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: 'var(--md-sys-typescale-label-large-tracking, 0.1px)',
                animation: 'jfp-fade-in 0.3s ease-out both'
            }}
        >
            {/* Icono nube-off minimalista, en línea con los SVG caseros del OSD. */}
            <svg width='16' height='16' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                <path
                    d='M3 3l18 18M9 5.5A7 7 0 0 1 19.4 11 4.5 4.5 0 0 1 21 19.5M6 8.2A5.5 5.5 0 0 0 7 19h9'
                    stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'
                />
            </svg>
            {globalize.translate('Offline')}
        </div>
    );
}
