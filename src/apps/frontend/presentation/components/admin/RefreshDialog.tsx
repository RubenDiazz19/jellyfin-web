// Qué se vuelve a pedir al servidor en un rescan.
//
// Antes había un solo botón que siempre mandaba `FullRefresh` de metadatos Y
// de imágenes. Con eso, rescanear para que apareciera un capítulo nuevo podía
// cambiar de paso las carátulas que el proveedor hubiera decidido rellenar, y
// no había forma de pedir «solo lo nuevo».
//
// Esta caja es la del Jellyfin nativo (components/refreshdialog) con la piel
// de la app: los mismos tres modos y los mismos dos reemplazos, que se mandan
// tal cual a `/Items/{id}/Refresh`. La diferencia es que aquí cada modo lleva
// escrito debajo qué toca y qué respeta, que es lo que el select nativo —tres
// líneas sueltas sin explicación— dejaba adivinar.

import { useState } from 'react';

import globalize from 'lib/globalize';

import type { RefreshMode, RefreshOptions } from '../../../domain/api';
import { Dialog, DialogFooter, DialogHeader } from '../controls/Dialog';
import { PillButton } from '../controls/fields';
import { T } from '../../theme/tokens';

type Props = {
    /** Sobre qué se actúa: el nombre de la biblioteca o el título del item. */
    subject: string;
    /**
     * Ejecuta lo elegido. Si el servidor dice que no, tiene que lanzar: la
     * caja se queda abierta para poder reintentar sin recomponer la elección.
     */
    onRefresh: (options: RefreshOptions) => Promise<void>;
    onClose: () => void;
};

const MODES: ReadonlyArray<readonly [RefreshMode, string, string]> = [
    ['scan', 'ScanForNewAndUpdatedFiles', 'RefreshModeScanHelp'],
    ['missing', 'SearchForMissingMetadata', 'RefreshModeMissingHelp'],
    ['all', 'ReplaceAllMetadata', 'RefreshModeAllHelp']
];

export function RefreshDialog({ subject, onRefresh, onClose }: Props) {
    // Arranca en `scan` igual que el nativo: es el que no toca nada de lo que
    // ya está, así que es el seguro para pulsar sin leer.
    const [mode, setMode] = useState<RefreshMode>('scan');
    const [replaceImages, setReplaceImages] = useState(false);
    const [replaceTrickplay, setReplaceTrickplay] = useState(false);
    const [busy, setBusy] = useState(false);

    // En modo `scan` el servidor no vuelve a preguntar a los proveedores, así
    // que no hay nada que reemplazar: las casillas no se enseñan (igual que en
    // el nativo) y `refreshItemMetadata` las ignora aunque quedaran marcadas.
    const canReplace = mode !== 'scan';

    const submit = async () => {
        setBusy(true);
        try {
            await onRefresh({ mode, replaceImages, replaceTrickplay });
            onClose();
        } catch {
            // El aviso lo da quien ejecuta, que es quien sabe sobre qué.
            setBusy(false);
        }
    };

    return (
        <Dialog
            label={globalize.translate('RefreshMetadata')}
            width={460}
            maxHeight='min(86vh, 680px)'
            column
            dismissable={!busy}
            onClose={onClose}
        >
            <DialogHeader
                title={globalize.translate('RefreshMetadata')}
                subtitle={subject}
                onClose={onClose}
            />

            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <div style={{
                    fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
                    color: T.dim, margin: '0 0 6px'
                }}>
                    {globalize.translate('LabelRefreshMode')}
                </div>

                <div role='radiogroup' aria-label={globalize.translate('LabelRefreshMode')}>
                    {MODES.map(([value, labelKey, helpKey]) => (
                        <ChoiceRow
                            key={value}
                            kind='radio'
                            checked={mode === value}
                            label={globalize.translate(labelKey)}
                            hint={globalize.translate(helpKey)}
                            onClick={() => setMode(value)}
                        />
                    ))}
                </div>

                {canReplace && (
                    <div style={{ marginTop: 18 }}>
                        <ChoiceRow
                            kind='checkbox'
                            checked={replaceImages}
                            label={globalize.translate('ReplaceExistingImages')}
                            hint={globalize.translate('ReplaceExistingImagesHelp')}
                            onClick={() => setReplaceImages((v) => !v)}
                        />
                        <ChoiceRow
                            kind='checkbox'
                            checked={replaceTrickplay}
                            label={globalize.translate('ReplaceTrickplayImages')}
                            onClick={() => setReplaceTrickplay((v) => !v)}
                        />
                    </div>
                )}

                <div style={{
                    fontSize: 12, color: T.dim, lineHeight: 1.6, margin: '18px 0 16px'
                }}>
                    {globalize.translate('RefreshDialogHelp')}
                </div>
            </div>

            <DialogFooter>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <PillButton onClick={onClose} variant='ghost' busy={busy}>
                        {globalize.translate('ButtonCancel')}
                    </PillButton>
                    <PillButton onClick={submit} busy={busy}>
                        {globalize.translate(busy ? 'Starting' : 'Refresh')}
                    </PillButton>
                </div>
            </DialogFooter>
        </Dialog>
    );
}

/**
 * Una opción de la caja: el mando a la izquierda, el texto y su explicación a
 * la derecha. Redondo para «elige uno», cuadrado para «marca lo que quieras»,
 * que es la única diferencia entre los dos grupos de esta caja.
 */
function ChoiceRow({
    kind, checked, label, hint, onClick
}: {
    kind: 'radio' | 'checkbox';
    checked: boolean;
    label: string;
    hint?: string;
    onClick: () => void;
}) {
    const round = kind === 'radio';
    return (
        <button
            role={kind}
            aria-checked={checked}
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
                textAlign: 'left', padding: '11px 4px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#fff', fontFamily: T.ui
            }}
        >
            <span style={{
                flexShrink: 0, width: 19, height: 19, marginTop: 1,
                borderRadius: round ? '50%' : 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: checked && !round ? '#fff' : 'transparent',
                border: checked && !round ? 'none' : `2px solid ${checked ? '#fff' : 'rgba(255,255,255,0.35)'}`,
                color: '#000', fontSize: 12, lineHeight: 1,
                transition: 'background .15s, border-color .15s'
            }}>
                {checked && (round ?
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff' }} /> :
                    '✓')}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14 }}>{label}</span>
                {hint && (
                    <span style={{
                        display: 'block', fontSize: 12, color: T.dim,
                        marginTop: 3, lineHeight: 1.5
                    }}>
                        {hint}
                    </span>
                )}
            </span>
        </button>
    );
}
