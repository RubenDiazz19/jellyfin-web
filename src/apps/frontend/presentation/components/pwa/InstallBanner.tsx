// Banner M3 de instalación de la PWA — solo mobile/tablet, solo cuando el
// navegador ofrece beforeinstallprompt y la app no corre ya instalada.
// El rechazo se recuerda 14 días para no ser pesados.

import { useCallback, useEffect, useState } from 'react';

import {
    hasInstallPrompt,
    isStandalone,
    onInstallPromptChange,
    promptInstall
} from '../../../shared/pwa';
import { useMobileTheme } from '../../theme/MobileThemeProvider';
import { haptic } from '../../../shared/haptics';

const DISMISS_KEY = 'jfp-install-dismissed';
const DISMISS_DAYS = 14;

function dismissedRecently(): boolean {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts > 0 && Date.now() - ts < DISMISS_DAYS * 86_400_000;
}

export function InstallBanner() {
    const { layout } = useMobileTheme();
    const [promptReady, setPromptReady] = useState(hasInstallPrompt);
    const [hidden, setHidden] = useState(dismissedRecently);

    useEffect(
        () => onInstallPromptChange(() => setPromptReady(hasInstallPrompt())),
        []
    );

    const install = useCallback(() => {
        haptic('select');
        void promptInstall().then(() => setPromptReady(hasInstallPrompt()));
    }, []);

    const dismiss = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setHidden(true);
    }, []);

    if (!layout || !promptReady || hidden || isStandalone()) return null;

    const buttonBase = {
        padding: '10px 20px',
        border: 'none',
        borderRadius: 'var(--md-sys-shape-corner-full, 9999px)',
        fontFamily: 'inherit',
        fontSize: 'var(--md-sys-typescale-label-large-size, 14px)',
        fontWeight: 600,
        letterSpacing: 'var(--md-sys-typescale-label-large-tracking, 0.1px)',
        cursor: 'pointer'
    } as const;

    return (
        <div
            role='dialog'
            aria-label='Instalar aplicación'
            style={{
                position: 'fixed',
                // Deja libre la bottom bar (móvil) o el rail (tablet).
                left: layout === 'tablet' ? 104 : 16,
                right: 16,
                bottom: layout === 'mobile' ?
                    'calc(96px + env(safe-area-inset-bottom, 0px))' :
                    'calc(16px + env(safe-area-inset-bottom, 0px))',
                zIndex: 150,
                maxWidth: 480,
                margin: '0 auto',
                padding: 16,
                borderRadius: 'var(--md-sys-shape-corner-extra-large, 28px)',
                background: 'var(--md-sys-color-surface-container-high, #202020)',
                color: 'var(--md-sys-color-on-surface, #fff)',
                boxShadow: 'var(--md-sys-elevation-level3, 0 8px 24px rgba(0,0,0,0.5))',
                animation: 'jfp-fade-in 0.4s ease-out both'
            }}
        >
            <div style={{
                fontSize: 'var(--md-sys-typescale-title-medium-size, 16px)',
                fontWeight: 500,
                marginBottom: 4
            }}>
                Instalar Jellyfin
            </div>
            <div style={{
                fontSize: 'var(--md-sys-typescale-body-small-size, 12px)',
                color: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.7))',
                marginBottom: 14
            }}>
                Pantalla completa, acceso directo y biblioteca disponible sin conexión.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                    onClick={dismiss}
                    style={{
                        ...buttonBase,
                        background: 'transparent',
                        color: 'var(--md-sys-color-primary, #8ecff2)'
                    }}
                >
                    Ahora no
                </button>
                <button
                    onClick={install}
                    data-ripple
                    style={{
                        ...buttonBase,
                        background: 'var(--md-sys-color-primary, #8ecff2)',
                        color: 'var(--md-sys-color-on-primary, #00344a)'
                    }}
                >
                    Instalar
                </button>
            </div>
        </div>
    );
}
