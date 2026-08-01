import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { EmptyState, SkeletonRow } from '../components/skeleton/Skeleton';
import { ListBackLink } from './ListsPage';
import { EditableTitle } from '../components/controls/EditableTitle';
import { useItemContextMenu } from '../components/controls/useItemContextMenu';
import { PosterTile } from '../components/cards/PosterTile';
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
                <div style={{ marginBottom: 8 }}>
                    <EditableTitle
                        value={name || kindLabel}
                        fontSize={r.touch ? 34 : 52}
                        onSave={async (next) => {
                            await LISTS.rename(kind, listId, next);
                            setName(next);
                        }}
                    />
                </div>
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
 * Un título de la lista.
 *
 * No entra en el modo selección, a diferencia de la búsqueda: en una lista lo
 * que se hace con varios títulos a la vez es quitarlos de ella, y eso vive en
 * el menú de cada uno.
 */
function ListItemCard({ item, navigate }: { item: PlaylistItem; navigate: Navigate }) {
    const ctx = useItemContextMenu({
        id: item.id,
        type: item.kind === 'movie' ? 'movie' : 'show',
        itemTitle: item.title,
        queueSubtitle: item.year ? String(item.year) : undefined,
        queuePoster: item.poster
    });
    const kindKey = item.kind === 'movie' ? 'Movie' : item.kind === 'episode' ? 'Episode' : 'Series';
    return (
        <PosterTile
            title={item.title}
            kindLabel={globalize.translate(kindKey)}
            cover={item.poster}
            logo={item.logo}
            interactions={{
                // Un episodio suelto lleva a su serie: sin temporada ni número
                // no se puede construir la ruta del episodio, y la ficha de la
                // serie es el destino útil más cercano.
                onClick: () => (item.kind === 'movie' ?
                    navigate({ page: 'movie', movieId: item.id }) :
                    navigate({ page: 'show', showId: item.seriesId ?? item.id })),
                selecting: false,
                selected: false,
                onContextMenu: ctx.onContextMenu,
                contextMenu: ctx.menu
            }}
        />
    );
}
