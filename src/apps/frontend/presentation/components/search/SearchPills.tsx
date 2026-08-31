// Componentes de píldoras y botones de selección para el buscador de frontend.
// Optimizados con React.memo para evitar re-renderizados innecesarios durante el filtrado.

import globalize from 'lib/globalize';
import { memo } from 'react';
import { T } from '../../theme/tokens';

export type MainPillProps = {
    label: string;
    count: number;
    isOpen: boolean;
    onClick: () => void;
};

/**
 * Píldora principal de categoría (Tipo, Estado, Géneros, Valoración).
 * Si hay opciones seleccionadas se marca en blanco y muestra (X).
 * Al estar abierta, pulsarla cierra el submenú y regresa a la vista general.
 */
export const MainPill = memo(function MainPillBase({
    label,
    count,
    isOpen,
    onClick
}: MainPillProps) {
    const isSelected = count > 0;
    const displayText = isSelected ? `${label} (${count})` : label;

    return (
        <button
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            aria-label={displayText}
            aria-expanded={isOpen}
            aria-pressed={isSelected}
            style={{
                padding: '7px 16px',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: T.ui,
                fontSize: 13,
                fontWeight: isSelected ? 600 : 500,
                transition: 'all .18s ease',
                whiteSpace: 'nowrap',
                background: isSelected ? '#fff' : isOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                color: isSelected ? '#000' : isOpen ? '#fff' : T.dim,
                border: isSelected ? '1px solid #fff' : isOpen ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                boxShadow: isSelected ? '0 2px 10px rgba(255,255,255,0.18)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                flexShrink: 0
            }}
        >
            <span>{displayText}</span>
        </button>
    );
});

export type OptionPillProps = {
    label: string;
    selected: boolean;
    onClick: () => void;
    index?: number;
    animateIn?: boolean;
};

/**
 * Pequeña píldora de opción para la fila horizontal.
 * Si está seleccionada se marca en blanco.
 * Aparece con animación escalonada progresiva según su índice.
 */
export const OptionPill = memo(function OptionPillBase({
    label,
    selected,
    onClick,
    index = 0,
    animateIn = true
}: OptionPillProps) {
    return (
        <button
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            aria-label={label}
            aria-pressed={selected}
            style={{
                padding: '5px 14px',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: T.ui,
                fontSize: 12,
                fontWeight: selected ? 600 : 400,
                transition: 'background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease',
                whiteSpace: 'nowrap',
                background: selected ? '#fff' : 'rgba(255,255,255,0.06)',
                color: selected ? '#000' : 'rgba(255,255,255,0.75)',
                border: selected ? '1px solid #fff' : '1px solid rgba(255,255,255,0.14)',
                boxShadow: selected ? '0 2px 8px rgba(255,255,255,0.18)' : 'none',
                flexShrink: 0,
                animation: animateIn ? 'jfpSubPillIn 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both' : undefined,
                animationDelay: animateIn ? `${Math.min(index * 25, 200)}ms` : undefined
            }}
        >
            {label}
        </button>
    );
});

export type CollapsibleOptionPillProps = {
    label: string;
    selected: boolean;
    collapsed: boolean;
    onClick: () => void;
};

/**
 * Píldora que se pliega/colapsa con animación suave dentro de la opción seleccionada.
 */
export const CollapsibleOptionPill = memo(function CollapsibleOptionPillBase({
    label,
    selected,
    collapsed,
    onClick
}: CollapsibleOptionPillProps) {
    const isHidden = collapsed && !selected;

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                overflow: 'hidden',
                maxWidth: isHidden ? 0 : 120,
                opacity: isHidden ? 0 : 1,
                transform: isHidden ? 'scale(0.5)' : 'scale(1)',
                marginRight: isHidden ? 0 : (collapsed ? 0 : 4),
                transition: 'max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), margin-right 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: isHidden ? 'none' : undefined,
                flexShrink: 0
            }}
        >
            <OptionPill
                label={label}
                selected={selected}
                onClick={onClick}
                animateIn={false}
            />
        </div>
    );
});

export type AddFilterButtonProps = {
    onClick: () => void;
    isOpen?: boolean;
    title?: string;
};

/**
 * Botón circular discontinuo con icono + para añadir filtros o conmutar categorías.
 */
export const AddFilterButton = memo(function AddFilterButtonBase({
    onClick,
    isOpen = false,
    title
}: AddFilterButtonProps) {
    const defaultLabel = isOpen ? globalize.translate('CloseSelector') : globalize.translate('AddFilter');
    const label = title || defaultLabel;

    return (
        <button
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            title={label}
            aria-label={label}
            aria-expanded={isOpen}
            style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isOpen ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
                border: isOpen ? '1px solid #fff' : '1px dashed rgba(255,255,255,0.35)',
                color: '#fff',
                padding: 0,
                cursor: 'pointer',
                transition: 'all .2s ease',
                flexShrink: 0,
                transform: isOpen ? 'rotate(45deg)' : 'none',
                animation: 'jfpSubPillIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.borderColor = '#fff';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = isOpen ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = isOpen ? '#fff' : 'rgba(255,255,255,0.35)';
            }}
        >
            <svg width='10' height='10' viewBox='0 0 10 10' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'>
                <line x1='5' y1='1.5' x2='5' y2='8.5' />
                <line x1='1.5' y1='5' x2='8.5' y2='5' />
            </svg>
        </button>
    );
});
