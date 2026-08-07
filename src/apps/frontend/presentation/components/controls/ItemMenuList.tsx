// Las entradas de un menú de item, en sus dos formas: la hoja que sube desde
// abajo en táctil y el desplegable anclado de escritorio.
//
// Antes era el mismo `map` escrito dos veces, una por forma, y cada arreglo
// —una entrada desactivada que no se veía desactivada, un separador que no
// separaba— había que hacerlo dos veces o quedaba a medias. Lo que cambia de
// verdad entre las dos es el tamaño del blanco (48px en el dedo) y de dónde
// salen los colores: la hoja los toma de los tokens M3, que siguen al tema.

import { type ReactNode } from 'react';
import { T } from '../../theme/tokens';

export type MenuItem =
  | { isDivider: true }
  | { isCustom: true; component: ReactNode }
  | { label: string; fn: () => void; danger?: boolean; disabled?: boolean };

export function ItemMenuList({
    items, sheet, onPick
}: {
    items: MenuItem[];
    /** La hoja de táctil: dianas grandes y colores del tema. */
    sheet?: boolean;
    /** Se llama tras ejecutar la entrada, para cerrar el menú. */
    onPick: () => void;
}) {
    return (
        <>
            {items.map((it, i) => {
                if ('isDivider' in it) {
                    return (
                        <div
                            key={i}
                            style={{
                                height: 1,
                                margin: sheet ? '6px 16px' : '6px 0',
                                background: sheet ?
                                    'var(--md-sys-color-outline-variant, rgba(255,255,255,0.08))' :
                                    'rgba(255,255,255,0.08)'
                            }}
                        />
                    );
                }
                if ('isCustom' in it) return <div key={i}>{it.component}</div>;
                return (
                    <button
                        key={i}
                        data-ripple={sheet ? '' : undefined}
                        onClick={(e) => { e.stopPropagation(); it.fn(); onPick(); }}
                        disabled={it.disabled}
                        style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            background: 'none', border: 'none',
                            color: entryColor(it.disabled, it.danger, sheet),
                            cursor: it.disabled ? 'not-allowed' : 'pointer',
                            fontFamily: T.ui,
                            ...(sheet ? {
                                minHeight: 48, padding: '12px 16px', fontSize: 15,
                                borderRadius: 'var(--md-sys-shape-corner-large, 16px)'
                            } : {
                                padding: '11px 12px', fontSize: 14, borderRadius: 8,
                                letterSpacing: 0.1, transition: 'background .15s'
                            })
                        }}
                        // El realce del desplegable se hace a mano porque no hay
                        // hoja de estilos para estos botones; en táctil no hay
                        // puntero y lo que da respuesta es el ripple.
                        onMouseEnter={sheet ? undefined : (e) => {
                            if (it.disabled) return;
                            e.currentTarget.style.background = it.danger ?
                                'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.08)';
                        }}
                        onMouseLeave={sheet ? undefined : (e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {it.label}
                    </button>
                );
            })}
        </>
    );
}

function entryColor(disabled?: boolean, danger?: boolean, sheet?: boolean) {
    if (disabled) {
        return sheet ?
            'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.35))' :
            'rgba(255,255,255,0.35)';
    }
    if (danger) return sheet ? 'var(--md-sys-color-error, #ff6b6b)' : '#ff6b6b';
    return sheet ? 'var(--md-sys-color-on-surface, #fff)' : '#fff';
}
