import globalize from 'lib/globalize';
import { memo } from 'react';
import { PosterTile } from '../PosterTile';
import { useCardInteractions } from '../useCardInteractions';
import type { CatalogItem } from '../../../../domain/models';
import type { Navigate } from '../../../../app/router';

type Props = { item: CatalogItem; navigate: Navigate };

export const SearchGenericCard = memo(function SearchGenericCardBase({ item, navigate }: Props) {
    const interactions = useCardInteractions(
        { id: item.id, title: item.title, kind: item.kind, poster: item.poster, year: item.year },
        navigate
    );

    return (
        <PosterTile
            title={item.title}
            kindLabel={globalize.translate(item.kind === 'collection' ? 'Collection' : item.kind === 'show' ? 'Series' : 'Movie')}
            cover={item.poster || item.backdrop}
            logo={item.logo}
            interactions={interactions}
            aspectRatio='2/3'
        />
    );
});
