import { Ic } from '../../theme/icons';
import { useFav } from '../../../domain/hooks/useFav';
import { IconButton } from './IconButton';
import { useToast } from '../toast/ToastProvider';

type Props = { id: string; size?: number; label?: string };

export function FavButton({ id, size = 18, label }: Props) {
  const [fav, toggle] = useFav(id);
  const toast = useToast();
  const onClick = () => {
    toggle();
    const title = label ? ` · ${label}` : '';
    toast(fav ? `Quitado de favoritos${title}` : `Añadido a favoritos${title}`);
  };
  return (
    <IconButton onClick={onClick} ariaLabel={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
      <Ic.Heart size={size} filled={fav} />
    </IconButton>
  );
}
