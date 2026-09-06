import { memo } from 'react';
import type { CatalogItem } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import { MovieCard } from './MovieCard';
import { PosterCard } from './PosterCard';

// Tarjeta polimórfica para las filas curadas de la Home (añadidos recientemente,
// favoritos, más vistos). Despacha a PosterCard (series) o MovieCard (películas)
// a partir del `kind` de un CatalogItem unificado, aislando a la fila de los
// tipos concretos de cada medio.

type Props = {
    item: CatalogItem;
    navigate: Navigate;
    fluid?: boolean;
};

export const CatalogCard = memo(function CatalogCardBase({ item, navigate, fluid }: Props) {
    if (item.kind === 'show') {
        return <PosterCard slide={item} navigate={navigate} fluid={fluid} />;
    }
    return <MovieCard movie={item} navigate={navigate} fluid={fluid} />;
});
