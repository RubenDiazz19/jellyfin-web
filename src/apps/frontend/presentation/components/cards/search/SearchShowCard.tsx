import globalize from 'lib/globalize';
import { memo } from 'react';
import { PosterTile } from '../PosterTile';
import { useCardInteractions } from '../useCardInteractions';
import { FavButton } from '../../controls/buttons/FavButton';
import { ShowNavWatchedButton } from '../../controls/toggles/ShowNavWatchedButton';
import type { CatalogItem } from '../../../../domain/models';
import type { Navigate } from '../../../../app/router';

type Props = { item: CatalogItem; navigate: Navigate };

export const SearchShowCard = memo(function SearchShowCardBase({ item, navigate }: Props) {
    const interactions = useCardInteractions(
        { id: item.id, title: item.title, kind: item.kind, poster: item.poster, year: item.year },
        navigate
    );

    return (
        <PosterTile
            title={item.title}
            kindLabel={globalize.translate('Series')}
            cover={item.poster || item.backdrop}
            logo={item.logo}
            interactions={interactions}
            aspectRatio='2/3'
            watchedButton={<ShowNavWatchedButton showId={item.id} size={16} badge />}
            favButton={<FavButton id={item.id} size={16} />}
        />
    );
});
