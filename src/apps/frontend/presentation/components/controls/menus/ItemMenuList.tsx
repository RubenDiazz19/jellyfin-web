// Las entradas de un menú de item, en sus dos formas: la hoja que sube desde
// abajo en táctil y el desplegable anclado de escritorio.
//
// Antes era el mismo `map` escrito dos veces, una por forma, y cada arreglo
// —una entrada desactivada que no se veía desactivada, un separador que no
// separaba— había que hacerlo dos veces o quedaba a medias. Lo que cambia de
// verdad entre las dos es el tamaño del blanco (48px en el dedo) y de dónde
// salen los colores: la hoja los toma de los tokens M3, que siguen al tema.

import { type ReactNode } from 'react';
import { MenuEntry } from './MenuEntry';

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
                    <MenuEntry
                        key={i}
                        sheet={sheet}
                        disabled={it.disabled}
                        danger={it.danger}
                        onClick={() => { it.fn(); onPick(); }}
                    >
                        {it.label}
                    </MenuEntry>
                );
            })}
        </>
    );
}

