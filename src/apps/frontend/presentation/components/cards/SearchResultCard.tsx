import { memo } from 'react';
import type { CatalogItem } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import { SearchMovieCard, SearchShowCard, SearchCollectionCard, SearchGenericCard } from './search';

type Props = { item: CatalogItem; navigate: Navigate };

export const SearchResultCard = memo(function SearchResultCardBase({ item, navigate }: Props) {
    if (item.kind === 'movie') {
        return <SearchMovieCard item={item} navigate={navigate} />;
    }
    if (item.kind === 'show') {
        return <SearchShowCard item={item} navigate={navigate} />;
    }
    if (item.kind === 'collection') {
        return <SearchCollectionCard item={item} navigate={navigate} />;
    }
    return <SearchGenericCard item={item} navigate={navigate} />;
});
