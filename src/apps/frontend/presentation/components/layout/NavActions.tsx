import { FavButton } from '../controls/FavButton';
import { WatchedButton } from '../controls/WatchedButton';
import { MovieWatchedButton } from '../controls/MovieWatchedButton';
import { ShowNavWatchedButton } from '../controls/ShowNavWatchedButton';
import type { Movie } from '../../../domain/models';

export type NavActionData =
  | { type: 'show'; id: string }
  | { type: 'movie'; movie: Movie }
  | { type: 'episode'; id: string };

type Props = {
    actionId: string;
    actionData?: NavActionData;
    withDivider?: boolean;
};

// Acciones de cabecera en el Nav (favorito y visto) compartidas entre mobile y desktop.
export function NavActions({ actionId, actionData, withDivider = false }: Props) {
    return (
        <>
            <FavButton id={actionId} size={18} />
            {actionData?.type === 'show' ? (
                <ShowNavWatchedButton showId={actionData.id} size={18} />
            ) : actionData?.type === 'movie' ? (
                <MovieWatchedButton movie={actionData.movie} size={18} />
            ) : (
                <WatchedButton
                    id={actionId}
                    serverId={actionData?.type === 'episode' ? actionData.id : undefined}
                    size={18}
                />
            )}
            {withDivider && (
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.18)' }} />
            )}
        </>
    );
}
