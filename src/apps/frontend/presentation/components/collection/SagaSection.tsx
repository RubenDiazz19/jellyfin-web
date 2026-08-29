// Fila interactiva para la cronología de una franquicia / saga de películas.
// Muestra las películas de la colección ordenadas en el tiempo y destaca la película actual.

import globalize from 'lib/globalize';
import { T } from '../../theme/tokens';
import { MovieCard } from '../cards/MovieCard';
import { DetailHeading } from '../layout/DetailSections';
import type { MovieSaga } from '../../../domain/models';
import type { Navigate } from '../../../app/router';

type Props = {
    saga: MovieSaga;
    currentMovieId: string;
    navigate: Navigate;
};

export function SagaSection({ saga, currentMovieId, navigate }: Props) {
    if (!saga.items || saga.items.length <= 1) return null;

    return (
        <div style={{ marginTop: 64 }}>
            <DetailHeading
                title={saga.name}
                marginBottom={24}
                onTitleClick={() => navigate({ page: 'list', kind: 'collection', listId: saga.id })}
            >
                <div style={{ fontFamily: T.ui, fontSize: 12, color: T.dim }}>
                    {globalize.translate('FranchiseChronology')} ({saga.items.length})
                </div>
            </DetailHeading>
            <div style={{
                display: 'flex',
                gap: 20,
                overflowX: 'auto',
                paddingBottom: 16,
                paddingTop: 4,
                scrollbarWidth: 'thin'
            }}>
                {saga.items.map((m, index) => {
                    const isCurrent = m.id === currentMovieId;
                    return (
                        <div
                            key={m.id}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                flexShrink: 0
                            }}
                        >
                            <div style={{
                                position: 'relative',
                                borderRadius: 8,
                                outline: isCurrent ? '2px solid rgba(255, 255, 255, 0.85)' : 'none',
                                outlineOffset: 3,
                                boxShadow: isCurrent ? '0 0 16px rgba(255, 255, 255, 0.25)' : 'none',
                                transition: 'outline .2s ease, box-shadow .2s ease'
                            }}>
                                <MovieCard movie={m} navigate={navigate} />
                                {isCurrent && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 8,
                                        left: 8,
                                        background: 'rgba(0, 0, 0, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.45)',
                                        color: '#fff',
                                        fontSize: 9,
                                        fontWeight: 700,
                                        letterSpacing: 0.6,
                                        padding: '2.5px 7px',
                                        borderRadius: 4,
                                        backdropFilter: 'blur(6px)',
                                        WebkitBackdropFilter: 'blur(6px)',
                                        pointerEvents: 'none',
                                        zIndex: 4,
                                        textTransform: 'uppercase'
                                    }}>
                                        {globalize.translate('CurrentlyWatching')}
                                    </div>
                                )}
                            </div>
                            <div style={{
                                marginTop: 8,
                                textAlign: 'center',
                                fontFamily: T.ui,
                                fontSize: 11,
                                color: isCurrent ? '#fff' : T.dim,
                                fontWeight: isCurrent ? 600 : 400
                            }}>
                                {index + 1}. {m.year}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
