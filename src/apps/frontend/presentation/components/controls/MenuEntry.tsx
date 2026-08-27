import type { CSSProperties, ReactNode } from 'react';
import { T } from '../../theme/tokens';

type Props = {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    danger?: boolean;
    sheet?: boolean;
    style?: CSSProperties;
};

export function entryColor(disabled?: boolean, danger?: boolean, sheet?: boolean) {
    if (disabled) {
        return sheet ?
            'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.35))' :
            'rgba(255,255,255,0.35)';
    }
    if (danger) return sheet ? 'var(--md-sys-color-error, #ff6b6b)' : '#ff6b6b';
    return sheet ? 'var(--md-sys-color-on-surface, #fff)' : '#fff';
}

// Botón de opción de menú unificado para menús flotantes de escritorio y bottom sheets móviles.
export function MenuEntry({
    children,
    onClick,
    disabled = false,
    danger = false,
    sheet = false,
    style
}: Props) {
    return (
        <button
            data-ripple={sheet ? '' : undefined}
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled && onClick) onClick();
            }}
            disabled={disabled}
            style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none',
                color: entryColor(disabled, danger, sheet),
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: T.ui,
                ...(sheet ? {
                    minHeight: 48, padding: '12px 16px', fontSize: 15,
                    borderRadius: 'var(--md-sys-shape-corner-large, 16px)'
                } : {
                    padding: '11px 12px', fontSize: 14, borderRadius: 8,
                    letterSpacing: 0.1, transition: 'background .15s'
                }),
                ...style
            }}
            onMouseEnter={sheet ? undefined : (e) => {
                if (disabled) return;
                e.currentTarget.style.background = danger ?
                    'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={sheet ? undefined : (e) => {
                e.currentTarget.style.background = 'transparent';
            }}
        >
            {children}
        </button>
    );
}
