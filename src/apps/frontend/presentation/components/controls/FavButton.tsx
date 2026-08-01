import globalize from 'lib/globalize';

import { Ic } from '../../theme/icons';
import { favoriteServerId, toggleFavorite } from '../../../domain/api';
import { useFav } from '../../../domain/bridge/useFav';
import { useSession } from '../../../domain/bridge/useSession';
import { IconButton } from './IconButton';
import { useToast } from '../toast/ToastProvider';

type Props = { id: string; size?: number; label?: string };

/**
 * El corazón. Pinta desde el store local —instantáneo, y es lo que leen las
 * decenas de tarjetas de la Home— y manda el cambio a Jellyfin, que es quien
 * lo conserva entre dispositivos.
 *
 * El id del servidor no se pasa por props: `favoriteServerId` lo saca de la
 * clave, y para temporadas y episodios lo busca en la serie, que a estas
 * alturas está en el caché de `getShow`. Así cualquier FavButton sincroniza
 * sin que su callsite tenga que enterarse.
 */
export function FavButton({ id, size = 18, label }: Props) {
    const [fav, setFav] = useFav(id);
    const toast = useToast();
    const { session } = useSession();

    const onClick = async () => {
        const next = !fav;
        // El corazón cambia ya; el servidor confirma o revierte.
        setFav(next);
        const suffix = label ? ` · ${label}` : '';
        const message = globalize.translate(
            next ? 'MessageAddedToFavorites' : 'MessageRemovedFromFavorites'
        ) + suffix;

        if (!session?.accessToken) {
            // Sin sesión el store local es toda la verdad que hay.
            toast(message);
            return;
        }
        try {
            const serverId = await favoriteServerId(id);
            if (!serverId) throw new Error(globalize.translate('MessageFavoriteNotOnServer'));
            await toggleFavorite(serverId, next);
            toast(message, 'success');
        } catch (e) {
            setFav(!next);
            toast((e as Error).message, 'warn');
        }
    };

    return (
        <IconButton onClick={onClick} ariaLabel={globalize.translate(fav ? 'RemoveFromFavorites' : 'AddToFavorites')}>
            <Ic.Heart size={size} filled={fav} />
        </IconButton>
    );
}
