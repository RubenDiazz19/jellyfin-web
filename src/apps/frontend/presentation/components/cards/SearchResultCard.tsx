import globalize from 'lib/globalize';

import { memo } from 'react';
import { PosterTile } from './PosterTile';
import { useCardInteractions } from './useCardInteractions';
import type { CatalogItem } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import { movieKey } from '../../../domain/stores';
import { FavButton } from '../controls/FavButton';
import { MovieWatchedButton } from '../controls/MovieWatchedButton';
import { ShowNavWatchedButton } from '../controls/ShowNavWatchedButton';

// Resultado del buscador. Todo el aspecto lo pone PosterTile; aquí solo se
// resuelve qué item es y cómo se llama su tipo.
//
// Recibe un `CatalogItem` y no el tipo de resultado del ViewModel de
// búsqueda: la tarjeta no tiene por qué saber de dónde salen los títulos que
// pinta, y así la misma sirve para cualquier listado.

type Props = { item: CatalogItem; navigate: Navigate };

export const SearchResultCard = memo(function SearchResultCardBase({ item, navigate }: Props) {
    const interactions = useCardInteractions(
        { id: item.id, title: item.title, kind: item.kind, poster: item.poster, year: item.year },
        navigate
    );

    let watchedButton;
    let favButton;
    if (item.kind === 'movie') {
        watchedButton = <MovieWatchedButton movie={item as any} size={16} badge />;
        favButton = <FavButton id={movieKey(item.id)} size={16} />;
    } else if (item.kind === 'show') {
        watchedButton = <ShowNavWatchedButton showId={item.id} size={16} badge />;
        favButton = <FavButton id={item.id} size={16} />;
    }

    return (
        <PosterTile
            title={item.title}
            kindLabel={globalize.translate(item.kind === 'collection' ? 'Collection' : item.kind === 'show' ? 'Series' : 'Movie')}
            cover={item.poster || item.backdrop}
            logo={item.logo}
            interactions={interactions}
            aspectRatio={item.kind === 'collection' ? '16/9' : '2/3'}
            watchedButton={watchedButton}
            favButton={favButton}
        />
    );
});
