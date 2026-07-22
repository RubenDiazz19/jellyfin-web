// Bottom sheet M3 (solo lo montan componentes en mobile/tablet). Portal a
// body con scrim, asa de arrastre visual, esquinas superiores extra-large y
// respeto de la safe-area inferior.

import { useEffect, type ReactNode } from 'react';
import ReactDOM from 'react-dom';

type Props = {
    title?: string;
    onClose: () => void;
    children: ReactNode;
};

export function BottomSheet({ title, onClose, children }: Props) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return ReactDOM.createPortal(
        <div
            // Cierra solo si el tap cae en el scrim (no dentro del sheet).
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            // El cierre-por-mousedown-fuera de quien nos abre (MoreButton) no
            // debe tragarse los taps dentro del sheet.
            onMouseDown={(e) => e.stopPropagation()}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
                background: 'rgba(0, 0, 0, 0.5)',
                animation: 'jfp-fade-in 0.2s ease-out both'
            }}
        >
            <div
                role='dialog'
                aria-label={title ?? 'Opciones'}
                style={{
                    position: 'fixed',
                    right: 0,
                    bottom: 0,
                    left: 0,
                    zIndex: 9999,
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    margin: '0 auto',
                    maxWidth: 560,
                    padding: '8px 8px calc(16px + env(safe-area-inset-bottom, 0px))',
                    background: 'var(--md-sys-color-surface-container, #1b1b1f)',
                    color: 'var(--md-sys-color-on-surface, #fff)',
                    borderRadius: 'var(--md-sys-shape-corner-extra-large, 28px) var(--md-sys-shape-corner-extra-large, 28px) 0 0',
                    boxShadow: 'var(--md-sys-elevation-level3, 0 -8px 24px rgba(0,0,0,0.5))',
                    animation: 'jfp-sheet-in var(--md-sys-motion-duration-medium2, 0.25s) var(--md-sys-motion-easing-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1)) both'
                }}
            >
                <div style={{
                    width: 32,
                    height: 4,
                    margin: '8px auto 12px',
                    borderRadius: 999,
                    background: 'var(--md-sys-color-outline-variant, rgba(255,255,255,0.25))'
                }}
                />
                {title && (
                    <div style={{
                        padding: '0 16px 10px',
                        fontSize: 'var(--md-sys-typescale-title-small-size, 14px)',
                        fontWeight: 500,
                        color: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.65))',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                    }}
                    >
                        {title}
                    </div>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}
