import globalize from 'lib/globalize';

import { useState } from 'react';
import { Ic } from '../../theme/icons';
import { IconButton } from '../controls/IconButton';
import { useToast } from '../toast/ToastProvider';
import { refreshItemMetadata } from '../../../domain/api';
import { tasksVM } from '../../../domain/viewModels/TasksViewModel';

type Props = {
    libraryId: string;
    libraryName: string;
};

// Rescan por biblioteca (Ajustes → Bibliotecas): mismo comportamiento que el
// "Scan Library" nativo de Jellyfin — el propio escaneo es quien regenera la
// imagen de la biblioteca en el server, no hace falta un editor aparte aquí.
export function LibraryCardMenu({ libraryId, libraryName }: Props) {
    const [scanning, setScanning] = useState(false);
    const toast = useToast();

    const doRescan = async () => {
        setScanning(true);
        try {
            await refreshItemMetadata(libraryId);
            // El progreso lo enseña TaskProgress; se anota aquí porque es
            // quien sabe cómo se llama esta biblioteca.
            tasksVM.expect(libraryId, libraryName);
            toast(globalize.translate('MessageLibraryScanStartedFor', libraryName), 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setScanning(false);
        }
    };

    return (
        <IconButton
            onClick={() => { void doRescan(); }}
            ariaLabel={`Reescanear ${libraryName}`}
            style={scanning ? { cursor: 'wait' } : undefined}
        >
            <span style={{
                display: 'block',
                animation: scanning ? 'jfp-video-spin 1s linear infinite' : undefined
            }}>
                <Ic.Refresh size={15} />
            </span>
        </IconButton>
    );
}
