// FAB Material 3 (solo se usa en mobile/tablet). Contenedor primary con
// esquina large y elevación 3. `extended` añade etiqueta al lado del icono.

import type { CSSProperties, ReactNode } from 'react';

type Props = {
    icon: ReactNode;
    label?: string;
    onClick: () => void;
    ariaLabel: string;
    style?: CSSProperties;
};

export function Fab({ icon, label, onClick, ariaLabel, style }: Props) {
    return (
        <button
            type='button'
            data-ripple
            onClick={onClick}
            aria-label={ariaLabel}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: label ? 8 : 0,
                height: 56,
                width: label ? 'auto' : 56,
                padding: label ? '0 20px' : 0,
                border: 'none',
                borderRadius: 'var(--md-sys-shape-corner-large, 16px)',
                background: 'var(--md-sys-color-primary-container, var(--md-sys-color-primary, #004b6f))',
                color: 'var(--md-sys-color-on-primary-container, var(--md-sys-color-on-primary, #fff))',
                boxShadow: 'var(--md-sys-elevation-level3, 0 8px 24px rgba(0,0,0,0.5))',
                fontFamily: 'inherit',
                fontSize: 'var(--md-sys-typescale-label-large-size, 14px)',
                fontWeight: 600,
                cursor: 'pointer',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                ...style
            }}
        >
            {icon}
            {label && <span>{label}</span>}
        </button>
    );
}
