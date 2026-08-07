import globalize from 'lib/globalize';

import { useState } from 'react';
import { Ic } from '../../theme/icons';
import { IconButton } from '../controls/IconButton';
import { useToast } from '../toast/ToastProvider';
import { refreshItemMetadata, type RefreshOptions } from '../../../domain/api';
import { tasksVM } from '../../../domain/viewModels/TasksViewModel';
import { RefreshDialog } from './RefreshDialog';

type Props = {
    libraryId: string;
    libraryName: string;
};

// Rescan por biblioteca (Ajustes → Bibliotecas): mismo comportamiento que el
// "Scan Library" nativo de Jellyfin — el propio escaneo es quien regenera la
// imagen de la biblioteca en el server, no hace falta un editor aparte aquí.
//
// Qué se rescanea lo elige el usuario en la caja: pulsar el botón ya no lanza
// un refresco completo a ciegas, que era lo que podía cambiar carátulas de
// paso. Ver RefreshDialog.
export function LibraryCardMenu({ libraryId, libraryName }: Props) {
    const [open, setOpen] = useState(false);
    const toast = useToast();

    const doRescan = async (options: RefreshOptions) => {
        try {
            await refreshItemMetadata(libraryId, options);
            // El progreso lo enseña TaskProgress; se anota aquí porque es
            // quien sabe cómo se llama esta biblioteca.
            tasksVM.expect(libraryId, libraryName);
            toast(globalize.translate('MessageLibraryScanStartedFor', libraryName), 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
            // Que la caja siga abierta: la elección no se ha llegado a aplicar.
            throw e;
        }
    };

    return (
        <>
            <IconButton
                onClick={() => setOpen(true)}
                ariaLabel={globalize.translate('RefreshMetadata') + ` · ${libraryName}`}
            >
                <Ic.Refresh size={15} />
            </IconButton>
            {open && (
                <RefreshDialog
                    subject={libraryName}
                    onRefresh={doRescan}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}
