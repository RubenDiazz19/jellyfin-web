import globalize from 'lib/globalize';

import { Ic } from '../../theme/icons';
import { useFav } from '../../../domain/bridge/useFav';
import { IconButton } from './IconButton';
import { useToast } from '../toast/ToastProvider';

type Props = { id: string; size?: number; label?: string };

export function FavButton({ id, size = 18, label }: Props) {
    const [fav, toggle] = useFav(id);
    const toast = useToast();
    const onClick = () => {
        toggle();
        const title = label ? ` · ${label}` : '';
        toast(globalize.translate(fav ? 'MessageRemovedFromFavorites' : 'MessageAddedToFavorites') + title);
    };
    return (
        <IconButton onClick={onClick} ariaLabel={globalize.translate(fav ? 'RemoveFromFavorites' : 'AddToFavorites')}>
            <Ic.Heart size={size} filled={fav} />
        </IconButton>
    );
}
