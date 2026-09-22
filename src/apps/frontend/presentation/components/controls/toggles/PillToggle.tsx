import { type ReactNode, type CSSProperties, type MouseEvent } from 'react';
import { T } from '../../../theme/tokens';

type Props = {
    active: boolean;
    onClick: (e: MouseEvent<HTMLButtonElement>) => void;
    children: ReactNode;
    style?: CSSProperties;
    /** Defaults to the standard solid active state (white background).
     * 'ghost' uses a subtle background for the active state (used in dropdown toggles). */
    variant?: 'solid' | 'ghost';
    /** Optional reference for anchor positioning */
    btnRef?: React.Ref<HTMLButtonElement>;
    /** Optional accessibility attributes */
    ariaHasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
    ariaExpanded?: boolean;
    onMouseDown?: (e: MouseEvent<HTMLButtonElement>) => void;
};

// Componente extraído de OptionPill, SelectToggle y SortControl.
// Estandariza los botones en forma de píldora que actúan como "toggles" (on/off).
export function PillToggle({
    active,
    onClick,
    children,
    style,
    variant = 'solid',
    btnRef,
    ariaHasPopup,
    ariaExpanded,
    onMouseDown
}: Props) {
    const isSolid = variant === 'solid';

    const bg = active ?
        (isSolid ? '#fff' : 'rgba(255,255,255,0.18)') :
        'rgba(255,255,255,0.08)';
    const fg = active ?
        (isSolid ? '#000' : '#fff') :
        T.dim;
    const border = active ?
        (isSolid ? '1px solid transparent' : '1px solid rgba(255,255,255,0.35)') :
        '1px solid rgba(255,255,255,0.15)';

    return (
        <button
            ref={btnRef}
            type='button'
            onClick={onClick}
            onMouseDown={onMouseDown}
            aria-haspopup={ariaHasPopup}
            aria-expanded={ariaExpanded}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 14px',
                borderRadius: 999,
                cursor: 'pointer',
                background: bg,
                color: fg,
                border: border,
                fontFamily: T.ui,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                transition: 'background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease, transform .2s ease',
                whiteSpace: 'nowrap',
                ...style
            }}
            onMouseEnter={(e) => {
                if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.color = '#fff';
                    if (!isSolid) {
                        e.currentTarget.style.transform = 'scale(1.02)';
                    }
                }
            }}
            onMouseLeave={(e) => {
                if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = T.dim;
                    if (!isSolid) {
                        e.currentTarget.style.transform = 'scale(1)';
                    }
                }
            }}
        >
            {children}
        </button>
    );
}
