import { useEffect } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { PosterCard } from '../cards/PosterCard';
import { MovieCard } from '../cards/MovieCard';
import { similarVM } from '../../../domain/viewModels/DiscoverViewModel';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import type { Navigate } from '../../../app/router';

type Props = {
    currentId: string;
    navigate: Navigate;
};

// "Más como esto": las sugerencias que da el servidor para este título,
// cruzando géneros, estudio, reparto y etiquetas sobre la biblioteca entera.
// La fila desaparece si no hay nada que sugerir — y mientras carga, que es
// otra forma de no tener nada todavía.
export function Similar({ currentId, navigate }: Props) {
    useViewModel(similarVM);
    useEffect(() => {
        void similarVM.load(currentId);
    }, [currentId]);

    const shows = similarVM.shows.value;
    const movies = similarVM.movies.value;
    if (shows.length === 0 && movies.length === 0) return null;

    return (
        <div style={{ marginTop: 88 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 24 }}>
                <h3 style={{
                    fontFamily: T.ui, fontSize: 30, fontWeight: 300, margin: 0
                }}>
                    {globalize.translate('HeaderMoreLikeThis')}
                </h3>
                <div style={{ fontFamily: T.ui, fontSize: 12, color: T.dim }}>
                    {globalize.translate('MessageBasedOnGenres')}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 24, overflowX: 'auto' }}>
                {shows.map((s) => <PosterCard key={`s-${s.id}`} slide={s} navigate={navigate} />)}
                {movies.map((m) => <MovieCard key={`m-${m.id}`} movie={m} navigate={navigate} />)}
            </div>
        </div>
    );
}
