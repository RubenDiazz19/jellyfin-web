import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { EmptyState, SkeletonRow } from '../components/skeleton/Skeleton';
import { ListBackLink } from './ListsPage';
import { getCollectionItems, getPlaylistItems, type PlaylistItem } from '../../domain/api';
import { displayItems, LISTS, type ListKind } from '../../domain/stores';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type Props = { kind: ListKind; listId: string; navigate: Navigate };

// Contenido de una lista: de reproducción o colección. De cara a esta página
// la única diferencia entre las dos es de dónde se leen los títulos y si hay
// que plegar series — de eso se encarga `displayItems`.

export function ListPage({ kind, listId, navigate }: Props) {
    const r = useResponsive();
    const [items, setItems] = useState<PlaylistItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState<string>(() => LISTS.find(kind, listId)?.name ?? '');

    useEffect(() => {
        setItems(null);
        setError(null);
        const fetchItems = kind === 'playlist' ? getPlaylistItems : getCollectionItems;
        fetchItems(listId)
            .then((all) => setItems(displayItems(kind, all)))
            .catch((e) => setError((e as Error).message));
        // El nombre puede no estar cacheado si se ha entrado por URL directa.
        if (!name) {
            void LISTS.ensure().then(() => setName(LISTS.find(kind, listId)?.name ?? ''));
        }
        // `name` fuera de las dependencias a propósito: solo se resuelve una
        // vez por lista, y meterlo relanzaría el efecto al llegar.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, listId]);

    const kindLabel = globalize.translate(kind === 'playlist' ? 'Playlists' : 'Collections');

    return (
        <>
            <Nav navigate={navigate} active='lists' />
            <section style={{
                background: r.touch ? MC.bg : '#000', color: r.touch ? MC.fg : '#fff',
                minHeight: '100vh',
                padding: r.touch ? `76px ${r.pagePad}px 48px` : '120px 56px 96px',
                fontFamily: T.ui
            }}>
                <ListBackLink navigate={navigate} />
                <h1 style={{
                    fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                    fontSize: r.touch ? 34 : 52, margin: '0 0 8px', letterSpacing: -0.5
                }}>
                    {name || kindLabel}
                </h1>
                {/* Qué tipo de lista es: importa, porque una de reproducción
                    desmenuza las series en capítulos y una colección no. */}
                <div style={{
                    fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
                    color: T.dim, marginBottom: 44
                }}>
                    {kindLabel}
                </div>

                {error ? (
                    <EmptyState title={globalize.translate('MessageNoPlaylistsYet')} hint={error} />
                ) : !items ? (
                    <SkeletonRow title='' />
                ) : items.length === 0 ? (
                    <EmptyState
                        title={globalize.translate('MessageNoItemsFound')}
                        hint={globalize.translate('ListsEmpty')}
                        icon='☰'
                    />
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill, minmax(${r.touch ? (r.mobile ? 110 : 140) : 160}px, 1fr))`,
                        gap: r.touch ? `${r.gap + 6}px ${r.gap}px` : '28px 20px'
                    }}>
                        {items.map((item) => (
                            <ListItemCard key={item.id} item={item} navigate={navigate} />
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}

/**
 * Tarjeta de un título de la lista. Mismo tratamiento que el resultado de
 * búsqueda: carátula con el logo (o el título) superpuesto y la etiqueta de
 * tipo arriba, sin pie de texto.
 */
function ListItemCard({ item, navigate }: { item: PlaylistItem; navigate: Navigate }) {
    const go = () => {
        // Un episodio suelto lleva a su serie: sin temporada ni número no se
        // puede construir la ruta del episodio, y la ficha de la serie es el
        // destino útil más cercano.
        if (item.kind === 'movie') navigate({ page: 'movie', movieId: item.id });
        else navigate({ page: 'show', showId: item.seriesId ?? item.id });
    };
    const kindKey = item.kind === 'movie' ? 'Movie' : item.kind === 'episode' ? 'Episode' : 'Series';

    return (
        <div onClick={go} style={{ cursor: 'pointer' }} className='jfp-hoverlift'>
            <div style={{
                aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', position: 'relative',
                background: 'rgba(255,255,255,0.05)',
                backgroundImage: item.poster ? `url(${item.poster})` : 'none',
                backgroundSize: 'cover', backgroundPosition: 'center'
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))'
                }} />
                <div style={{ position: 'absolute', top: 8, left: 10 }}>
                    <span style={{
                        fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.55)', background: 'rgba(0,0,0,0.5)',
                        padding: '3px 7px', borderRadius: 4
                    }}>
                        {globalize.translate(kindKey)}
                    </span>
                </div>
                {!item.poster && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: T.display, fontSize: 32, color: 'rgba(255,255,255,0.15)'
                    }}>
                        {item.title?.[0]}
                    </div>
                )}
                <div style={{
                    position: 'absolute', left: 12, right: 12, bottom: 12,
                    filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.7))'
                }}>
                    {item.logo ? (
                        <img
                            src={item.logo}
                            alt={item.title}
                            loading='lazy'
                            decoding='async'
                            style={{
                                maxWidth: '100%', maxHeight: 36, width: 'auto', height: 'auto',
                                objectFit: 'contain', objectPosition: 'left center'
                            }}
                        />
                    ) : (
                        // La sombra va como `drop-shadow` del contenedor y no
                        // como `text-shadow` aquí: el recorte a dos líneas
                        // necesita `overflow: hidden`, que cortaría la sombra
                        // en seco y dejaría un rectángulo alrededor del título.
                        <div style={{
                            fontFamily: T.display, fontSize: 15, fontWeight: 600, lineHeight: 1.2,
                            color: '#fff',
                            overflow: 'hidden',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                        }}>
                            {item.title}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
