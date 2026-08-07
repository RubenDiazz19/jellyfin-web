import globalize from 'lib/globalize';

import { useState } from 'react';
import { T } from '../../theme/tokens';
import { Dialog } from './Dialog';
import { PillButton } from './fields';

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

    return (
        <Dialog
            label={title}
            role='alertdialog'
            padding={22}
            // Mientras borra, pulsar fuera no cierra: la petición seguiría su
            // curso y esconderla solo confundiría sobre si llegó a pasar.
            dismissable={!busy}
            onClose={onClose}
        >
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.6 }}>{message}</div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                {/* El foco arranca en Cancelar: un Enter de inercia cancela, no
                    borra. Es la diferencia entre esto y un confirm(). */}
                <PillButton
                    onClick={onClose}
                    variant='ghost'
                    busy={busy}
                    autoFocus
                    style={{ opacity: busy ? 0.5 : 1 }}
                >
                    {globalize.translate('ButtonCancel')}
                </PillButton>
                <PillButton onClick={doConfirm} variant='danger' busy={busy}>
                    {busy ? globalize.translate('Deleting') : confirmLabel}
                </PillButton>
            </div>
        </Dialog>
    );
}
