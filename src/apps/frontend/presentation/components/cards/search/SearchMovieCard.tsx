import globalize from 'lib/globalize';
import { memo } from 'react';
import { PosterTile } from '../PosterTile';
import { useCardInteractions } from '../useCardInteractions';
import { movieKey } from '../../../../domain/stores';
import { FavButton } from '../../controls/buttons/FavButton';
import { MovieWatchedButton } from '../../controls/toggles/MovieWatchedButton';
import type { CatalogItem, Movie } from '../../../../domain/models';
import type { Navigate } from '../../../../app/router';

type Props = { item: CatalogItem; navigate: Navigate };

export const SearchMovieCard = memo(function SearchMovieCardBase({ item, navigate }: Props) {
    const interactions = useCardInteractions(
        { id: item.id, title: item.title, kind: item.kind, poster: item.poster, year: item.year },
        navigate
    );

    return (
        <PosterTile
            title={item.title}
            kindLabel={globalize.translate('Movie')}
            cover={item.poster || item.backdrop}
            logo={item.logo}
            interactions={interactions}
            aspectRatio='2/3'
            watchedButton={<MovieWatchedButton movie={item as unknown as Movie} size={16} badge />}
            favButton={<FavButton id={movieKey(item.id)} size={16} />}
        />
    );
});
