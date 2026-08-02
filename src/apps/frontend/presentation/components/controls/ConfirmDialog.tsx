import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';

/** Rojo de las acciones que no se pueden deshacer. */
const DANGER = '#d64545';

type Props = {
    title: string;
    /** Qué va a pasar exactamente, en una frase. */
    message: string;
    /** Texto del botón que ejecuta. */
    confirmLabel: string;
    onConfirm: () => Promise<void>;
    onClose: () => void;
};

/**
 * Confirmación de una acción que no se puede deshacer.
 *
 * Existe por lo mismo que el botón de dos toques de las imágenes —quitar de en
 * medio el `window.confirm()`, que es una caja del sistema plantada sobre una
 * interfaz que no se le parece— pero aquí no vale el mismo remedio: esto se
 * dispara desde un menú desplegable, donde dos toques seguidos sobre el mismo
 * sitio son demasiado fáciles de encadenar sin querer, y lo que está en juego
 * es un fichero del disco.
 *
 * Así que la respuesta es al revés: hacerlo MÁS deliberado que un confirm del
 * navegador, no menos. Dos botones separados, el destructivo en rojo y a la
 * derecha, el foco puesto en Cancelar —de modo que un Enter reflejo cancela— y
 * el título de lo que se va a borrar delante.
 */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: Props) {
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const doConfirm = async () => {
        setBusy(true);
        try {
            await onConfirm();
            onClose();
        } catch {
            // De contarlo se encarga quien ejecuta la acción, que es quien
            // sabe qué se estaba haciendo. Aquí solo hay que poder reintentar.
            setBusy(false);
        }
    };

    return ReactDOM.createPortal(
        <div
            // Pulsar FUERA del panel cancela, salvo mientras se ejecuta. Se
            // compara el target en vez de parar la propagación desde dentro:
            // así el panel no necesita manejador propio y puede quedarse con
            // su `role`. El teclado sale por Escape o por Cancelar, que es
            // quien arranca con el foco.
            onClick={(e) => { if (!busy && e.target === e.currentTarget) onClose(); }}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
        >
            <div
                role='alertdialog'
                aria-modal='true'
                aria-label={title}
                style={{
                    width: 'min(420px, 100%)',
                    background: 'rgba(18,18,20,0.98)', borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                    padding: 22, fontFamily: T.ui, color: '#fff'
                }}
            >
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>{title}</div>
                <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.6 }}>{message}</div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                    <button
                        // El foco arranca aquí: un Enter de inercia cancela, no
                        // borra. Es la diferencia entre esto y un confirm().
                        autoFocus
                        onClick={onClose}
                        disabled={busy}
                        style={{
                            padding: '10px 18px', borderRadius: 999,
                            background: 'transparent', color: '#fff',
                            border: '1px solid rgba(255,255,255,0.25)',
                            fontFamily: T.ui, fontSize: 13, fontWeight: 500,
                            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1
                        }}
                    >
                        {globalize.translate('ButtonCancel')}
                    </button>
                    <button
                        onClick={doConfirm}
                        disabled={busy}
                        style={{
                            padding: '10px 18px', borderRadius: 999,
                            background: DANGER, color: '#fff', border: `1px solid ${DANGER}`,
                            fontFamily: T.ui, fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
                            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1
                        }}
                    >
                        {busy ? globalize.translate('Deleting') : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
