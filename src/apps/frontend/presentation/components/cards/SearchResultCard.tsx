import globalize from 'lib/globalize';

import React from 'react';
import { PosterTile } from './PosterTile';
import { useCardInteractions } from './useCardInteractions';
import type { CatalogItem } from '../../../domain/models';
import type { Navigate } from '../../../app/router';

// Resultado del buscador. Todo el aspecto lo pone PosterTile; aquí solo se
// resuelve qué item es y cómo se llama su tipo.
//
// Recibe un `CatalogItem` y no el tipo de resultado del ViewModel de
// búsqueda: la tarjeta no tiene por qué saber de dónde salen los títulos que
// pinta, y así la misma sirve para cualquier listado.

type Props = { item: CatalogItem; navigate: Navigate };

export const SearchResultCard = React.memo(function SearchResultCardBase({ item, navigate }: Props) {
    const interactions = useCardInteractions(
        { id: item.id, title: item.title, kind: item.kind, poster: item.poster, year: item.year },
        navigate
    );
    return (
        <PosterTile
            title={item.title}
            kindLabel={globalize.translate(item.kind === 'show' ? 'Series' : 'Movie')}
            cover={item.poster || item.backdrop}
            logo={item.logo}
            interactions={interactions}
        />
    );
});
