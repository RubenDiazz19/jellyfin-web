// Las piezas sueltas de un formulario: un campo de texto, un botón de
// píldora, y las dos líneas de texto —apagada y de error— que acompañan a
// todo lo que carga del servidor.
//
// Estaban repetidas literalmente en cada diálogo y en el editor de metadatos,
// con el resultado previsible: el mismo botón «Guardar» con tres paddings
// distintos según en qué caja se abriera. Aquí hay una sola definición de cada
// uno, y las diferencias que sí importan —el tamaño y qué papel juega el
// botón— son props.

import { type CSSProperties, type ReactNode } from 'react';
import { T } from '../../theme/tokens';

/** Rojo de las acciones que no se pueden deshacer. */
export const DANGER = '#d64545';

/** Rojo de los mensajes de error: más claro, para leerse sobre el panel. */
export const ERROR_FG = '#ff6b6b';

/**
 * Qué papel juega el botón:
 *
 * - `primary`, la acción de la caja: relleno en blanco.
 * - `ghost`, la salida o lo secundario: solo borde.
 * - `danger`, lo que no se puede deshacer: relleno en rojo.
 */
type Variant = 'primary' | 'ghost' | 'danger';

type ButtonProps = {
    onClick: () => void;
    variant?: Variant;
    /** `sm` dentro de una fila con un campo al lado; `md` en un pie de caja. */
    size?: 'sm' | 'md';
    /** Acción en vuelo: no se puede repetir y se nota que está pasando algo. */
    busy?: boolean;
    /** Falta algo para poder pulsarlo (un nombre, una etiqueta). */
    disabled?: boolean;
    /**
     * Arranca con el foco. Se usa para dejarlo en la salida de una caja de
     * confirmación: así un Enter de inercia cancela en vez de ejecutar.
     */
    autoFocus?: boolean;
    style?: CSSProperties;
    children: ReactNode;
};

export function PillButton({
    onClick, variant = 'primary', size = 'md', busy, disabled, autoFocus, style, children
}: ButtonProps) {
    // Un primario que no se puede pulsar todavía no puede quedarse blanco: es
    // lo más llamativo del panel y lo estaría pidiendo. Se apaga a un gris.
    const off = disabled && variant === 'primary';
    return (
        <button
            onClick={onClick}
            disabled={busy || disabled}
            autoFocus={autoFocus}
            style={{
                padding: size === 'sm' ? '9px 16px' : '10px 18px',
                borderRadius: 999,
                background: variant === 'primary' ? (off ? 'rgba(255,255,255,0.15)' : '#fff') :
                    variant === 'danger' ? DANGER : 'transparent',
                color: variant === 'primary' ? (off ? T.dim : '#000') : '#fff',
                border: variant === 'ghost' ? '1px solid rgba(255,255,255,0.25)' :
                    variant === 'danger' ? `1px solid ${DANGER}` : 'none',
                fontFamily: T.ui, fontSize: 13,
                fontWeight: variant === 'ghost' ? 500 : 600,
                letterSpacing: variant === 'ghost' ? undefined : 0.3,
                cursor: busy ? 'wait' : disabled ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
                // Es texto corto en una fila junto a un campo elástico: si se
                // le deja partir, «Crear lista» pasa a ocupar dos renglones.
                whiteSpace: 'nowrap',
                ...style
            }}
        >
            {children}
        </button>
    );
}

type FieldProps = {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    /** `sm` en las filas de los diálogos; `md` en los formularios del editor. */
    size?: 'sm' | 'md';
    /** Atajo del Enter, que es como se envían casi todos estos campos. */
    onEnter?: () => void;
    /** Para lo que el Enter no cubra (una tecla propia del diálogo). */
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function TextField({
    value, onChange, placeholder, autoFocus, size = 'sm', onEnter, onKeyDown
}: FieldProps) {
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                onKeyDown?.(e);
                if (e.key === 'Enter' && !e.defaultPrevented && onEnter) {
                    e.preventDefault();
                    onEnter();
                }
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)', color: '#fff',
                border: `1px solid rgba(255,255,255,${size === 'sm' ? 0.15 : 0.12})`,
                borderRadius: 8,
                padding: size === 'sm' ? '9px 12px' : '10px 12px',
                fontFamily: T.ui, fontSize: size === 'sm' ? 13 : 14,
                outline: 'none'
            }}
        />
    );
}

export function TextArea({
    value, onChange, rows = 4
}: {
    value: string; onChange: (v: string) => void; rows?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                padding: '10px 12px', fontFamily: T.ui, fontSize: 14,
                outline: 'none', resize: 'vertical'
            }}
        />
    );
}

/** Texto secundario: lo que carga, lo que está vacío, la nota de ayuda. */
export function Muted({ children }: { children: ReactNode }) {
    return <div style={{ color: T.dim, fontSize: 13, lineHeight: 1.5 }}>{children}</div>;
}

/** Lo que contestó el servidor cuando dijo que no. */
export function ErrText({ children }: { children: ReactNode }) {
    return <div style={{ color: ERROR_FG, fontSize: 13 }}>{children}</div>;
}
