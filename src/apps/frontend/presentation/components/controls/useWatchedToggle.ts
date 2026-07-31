// Flujo común de los botones de "visto".
//
// Episodio, película, temporada y serie se diferencian en qué estado agregan
// (un id, todos los episodios de una temporada, todos los de la serie) y en
// cómo se lee la frase del toast — el español no admite una sola redacción
// para "marcado/marcada/temporada marcada". Lo que hacían igual, y por
// cuadruplicado, es esto: pintar el cambio al instante, mandarlo al server si
// hay sesión y revertirlo si el server dice que no.

import { markPlayed } from '../../../domain/api';
import { useSession } from '../../../domain/bridge/useSession';
import { useToast } from '../toast/ToastProvider';

type Options = {
    /** Estado actual, ya agregado por quien llama. */
    active: boolean;
    /**
     * Aplica el cambio en el store local. Se invoca también para revertir,
     * así que tiene que saber ir en los dos sentidos.
     */
    applyLocal: (next: boolean) => void;
    /** Id del item en el server. Sin él el toggle se queda en local. */
    serverId?: string;
    /** Texto del toast para el estado al que se pasa. */
    message: (next: boolean) => string;
};

export function useWatchedToggle({ active, applyLocal, serverId, message }: Options): () => Promise<void> {
    const toast = useToast();
    const { session } = useSession();
    const canSync = !!session?.accessToken && !!serverId;

    return async () => {
        const next = !active;
        applyLocal(next);
        if (!canSync || !serverId) {
            // Sin sesión (prototipo) el store local es toda la verdad que hay.
            toast(message(next));
            return;
        }
        try {
            await markPlayed(serverId, next);
            toast(message(next), 'success');
        } catch (e) {
            applyLocal(!next);
            toast((e as Error).message, 'warn');
        }
    };
}
