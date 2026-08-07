// Lo que solo existe dentro del editor de metadatos. El campo de texto, los
// botones y las líneas de texto apagada/de error son los mismos de todo el
// app y viven en `controls/fields`.

import globalize from 'lib/globalize';

import React, { useEffect, useRef, useState } from 'react';
import { T } from '../../../theme/tokens';
import { DANGER } from '../../controls/fields';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
                fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: T.dim
            }}>{label}</label>
            {children}
        </div>
    );
}

/** Lo que tarda un botón armado en desarmarse solo. */
const ARM_TIMEOUT_MS = 4000;

type ConfirmState = 'idle' | 'armed' | 'busy';

/**
 * Borrado en dos toques: el primero arma el botón, el segundo ejecuta.
 *
 * Sustituye a `window.confirm()`, que planta un diálogo del sistema —con la
 * tipografía, los colores y la posición que decide el navegador— encima de una
 * interfaz que no se le parece en nada, y encima lejos de la imagen que se iba
 * a borrar. Aquí la pregunta aparece donde está el objeto, que es donde está
 * mirando el usuario, y el estado intermedio se ve: armado en rojo, borrando
 * en gris.
 *
 * Se desarma solo a los pocos segundos, y también al perder el foco: un botón
 * que se queda cargado indefinidamente es una trampa para el siguiente clic
 * despistado.
 */
export function ConfirmDeleteButton({
    onConfirm, variant = 'icon', idleLabel, confirmLabel
}: {
    /** Se invoca en el segundo toque. Que resuelva no implica que fuera bien. */
    onConfirm: () => Promise<void>;
    /** `icon` para superponerlo a una miniatura; `button` para una fila de acciones. */
    variant?: 'icon' | 'button';
    /** Etiqueta accesible —y texto, en `button`— del estado inicial. */
    idleLabel: string;
    /** Lo que se lee en el toque que borra de verdad. */
    confirmLabel: string;
}) {
    const [state, setState] = useState<ConfirmState>('idle');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    };
    useEffect(() => clearTimer, []);

    const onClick = async () => {
        if (state === 'busy') return;
        if (state === 'idle') {
            setState('armed');
            timer.current = setTimeout(() => setState('idle'), ARM_TIMEOUT_MS);
            return;
        }
        clearTimer();
        setState('busy');
        try {
            await onConfirm();
        } catch {
            // De contárselo al usuario se encarga quien borra, que es quien
            // sabe qué se estaba borrando. Aquí lo que importa es no dejar
            // colgada la promesa de un manejador de eventos.
        } finally {
            // Si el borrado va bien, este botón se desmonta con su imagen y
            // esto no llega a verse; si falla, hay que poder reintentar.
            setState('idle');
        }
    };

    const armed = state === 'armed';
    const label = armed ? confirmLabel : idleLabel;
    const common: React.CSSProperties = {
        cursor: state === 'busy' ? 'wait' : 'pointer',
        opacity: state === 'busy' ? 0.55 : 1,
        fontFamily: T.ui,
        transition: 'background .15s, border-color .15s, padding .15s, opacity .15s'
    };
    const props = {
        onClick,
        // Salir del botón lo desarma: si el usuario se ha ido a otra parte,
        // ya no está confirmando nada.
        onBlur: armed ? () => { clearTimer(); setState('idle'); } : undefined,
        'aria-label': label,
        title: label
    };

    if (variant === 'button') {
        return (
            <button
                {...props}
                style={{
                    ...common,
                    padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                    background: armed ? DANGER : 'transparent',
                    color: '#fff',
                    border: `1px solid ${armed ? DANGER : 'rgba(255,255,255,0.25)'}`
                }}
            >
                {state === 'busy' ? globalize.translate('Deleting') : label}
            </button>
        );
    }

    return (
        <button
            {...props}
            style={{
                ...common,
                position: 'absolute', top: 6, right: 6,
                height: 26, minWidth: 26, padding: armed ? '0 10px' : 0,
                borderRadius: 999, lineHeight: 1, fontSize: armed ? 11 : 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: armed ? DANGER : 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: `1px solid ${armed ? DANGER : 'rgba(255,255,255,0.2)'}`
            }}
        >
            {armed ? confirmLabel : '×'}
        </button>
    );
}

export function FooterRow({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12
        }}>{children}</div>
    );
}

export type ImgType = 'Primary' | 'Backdrop' | 'Logo';
