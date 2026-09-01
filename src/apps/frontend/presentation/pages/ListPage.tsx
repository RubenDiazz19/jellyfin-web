import { useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { HeroFrame } from '../components/layout/DetailHero';
import { DetailBody } from '../components/layout/DetailSections';
import { ScrollHint } from '../components/layout/ScrollHint';

import { ListBackLink } from './ListsPage';
import { EditableTitle } from '../components/controls/EditableTitle';
import { ListCardMenu, type ListMenuHandle } from '../components/controls/ListCardMenu';
import { useItemContextMenu } from '../components/controls/useItemContextMenu';
import { PosterTile } from '../components/cards/PosterTile';
import { CollectionCard } from '../components/collection/CollectionCard';
import { CollectionHero } from '../components/collection/CollectionHero';
import { PillButton } from '../components/controls/fields';
import { CreateCollectionDialog } from '../components/controls/CreateCollectionDialog';
import { CardGrid } from '../components/layout/CardGrid';
import { LoadState } from '../components/controls/LoadState';
import { getCollectionAncestors, getCollectionItems, getPlaylistItems, type PlaylistItem } from '../../domain/api';
import { displayItems, LISTS, type ListKind, type ListRef } from '../../domain/stores';

import { useListSync } from '../../domain/bridge/useLists';
import { useResponsive } from '../theme/responsive';

import type { Navigate, Route } from '../../app/router';

type Props = { kind: ListKind; listId: string; navigate: Navigate };

// Contenido de una lista: de reproducción o colección. De cara a esta página
// la única diferencia entre las dos es de dónde se leen los títulos y si hay
// que plegar series — de eso se encarga `displayItems`.
//
// La lista se abre con su hero a pantalla completa, como una ficha: el fondo
// es la imagen de la lista (la que haya puesto el usuario o, si no, la
// heredada del último título añadido) y los títulos aparecen al bajar.
//
// El hero va DESNUDO, sin una letra encima: la imagen se ve entera y ya está.
// El nombre —que se sigue pudiendo editar— y el recuento pasan a una franja
// discreta bajo el hero, y la imagen se cambia con el clic derecho encima.

export function ListPage({ kind, listId, navigate }: Props) {
    const [items, setItems] = useState<PlaylistItem[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ancestors, setAncestors] = useState<Array<{ id: string; name: string }>>([]);
    const { list, refresh } = useListSync(kind, listId);

    useEffect(() => {
        setItems(null);
        setError(null);
        const fetchItems = kind === 'playlist' ? getPlaylistItems : getCollectionItems;
        fetchItems(listId)
            .then((all) => setItems(displayItems(kind, all)))
            .catch((e) => setError((e as Error).message));

        if (kind === 'collection') {
            getCollectionAncestors(listId)
                .then(setAncestors)
                .catch(() => setAncestors([]));
        } else {
            setAncestors([]);
        }
    }, [kind, listId]);

    const kindLabel = globalize.translate(kind === 'playlist' ? 'Playlists' : 'Collections');

    const collectionMenuRef = useRef<ListMenuHandle | null>(null);

    if (kind === 'collection') {
        const fallbackBackdrop = items?.find((i) => i.backdrop || i.heroBackdrop)?.backdrop
            ?? items?.find((i) => i.backdrop || i.heroBackdrop)?.heroBackdrop
            ?? items?.[0]?.poster;

        return (
            <div
                onContextMenu={(e) => {
                    e.preventDefault();
                    collectionMenuRef.current?.openAt(e.clientX, e.clientY);
                }}
                style={{
                    position: 'relative',
                    width: '100vw',
                    height: '100vh',
                    overflow: 'hidden',
                    background: 'transparent'
                }}
            >
                <CollectionHero
                    listId={listId}
                    list={list}
                    ancestors={ancestors}
                    fallbackBackdrop={fallbackBackdrop}
                    navigate={navigate}
                    onChanged={refresh}
                    menuRef={collectionMenuRef}
                />
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000' }}>
            <ListHero
                kind={kind}
                listId={listId}
                list={list}
                ancestors={ancestors}
                kindLabel={kindLabel}
                navigate={navigate}
                onCoverChanged={refresh}
            />
            <DetailBody>
                <ListInfoStrip
                    kind={kind}
                    listId={listId}
                    list={list}
                    ancestors={ancestors}
                    kindLabel={kindLabel}
                    count={items?.length}
                    navigate={navigate}
                    onCoverChanged={refresh}
                />
                <ListGrid items={items} error={error} navigate={navigate} />
            </DetailBody>
        </div>
    );
}

/**
 * El hero de la lista: su fondo a pantalla completa y nada más encima.
 *
 * Ni una letra: el nombre y el recuento van en la franja de debajo. Como
 * tampoco hay botones, el menú de la imagen —el que permite ponerle una a
 * mano— se abre con el clic derecho, que es lo único que no ocupa sitio.
 */
function ListHero({
    kind, listId, list, ancestors, kindLabel, navigate, onCoverChanged
}: {
    kind: ListKind;
    listId: string;
    list: ListRef | undefined;
    ancestors: Array<{ id: string; name: string }>;
    kindLabel: string;
    navigate: Navigate;
    onCoverChanged: () => void;
}) {
    const menu = useRef<ListMenuHandle | null>(null);
    return (
        <HeroFrame
            backdrop={list?.heroImage ?? list?.image ?? ''}
            nav={
                <Nav
                    navigate={navigate}
                    active='lists'
                    breadcrumb={[
                        { label: globalize.translate('Lists'), to: { page: 'lists' } },
                        ...ancestors.map((a) => ({
                            label: a.name,
                            to: { page: 'list' as const, kind: 'collection' as const, listId: a.id }
                        })),
                        { label: list?.name ?? kindLabel }
                    ]}
                />
            }
            onContextMenu={(e) => {
                e.preventDefault();
                menu.current?.openAt(e.clientX, e.clientY);
            }}
            // Sin rótulo: solo la flecha, que no es texto encima de la imagen.
            footer={<ScrollHint label='' />}
        >
            {/* El menú existe pero no se ve: lo abre el clic derecho. */}
            <ListCardMenu
                hideTrigger
                handle={menu}
                kind={kind}
                listId={listId}
                onChanged={onCoverChanged}
                onDeleted={() => navigate({ page: 'lists' })}
            />
        </HeroFrame>
    );
}

/**
 * La franja de datos bajo el hero desnudo: nombre, tipo y cuántos títulos.
 *
 * Aquí es donde la lista conserva su nombre. Hace falta que esté escrito en
 * alguna parte: el del hero, cuando lo hay, va QUEMADO en la imagen, así que
 * ni se puede renombrar desde ahí ni lo lee un lector de pantalla. Los tres
 * puntos se quedan también aquí para el móvil, donde no hay clic derecho con
 * el que abrir el menú de la portada.
 */
function ListInfoStrip({
    kind, listId, list, ancestors, kindLabel, count, navigate, onCoverChanged
}: {
    kind: ListKind;
    listId: string;
    list: ListRef | undefined;
    ancestors: Array<{ id: string; name: string }>;
    kindLabel: string;
    count: number | undefined;
    navigate: Navigate;
    onCoverChanged: () => void;
}) {
    const r = useResponsive();
    const [createSub, setCreateSub] = useState(false);
    const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
    const backTo: Route | undefined = parent ?
        { page: 'list', kind: 'collection', listId: parent.id } :
        undefined;
    const backLabel: string | undefined = parent ? parent.name : undefined;

    return (
        <>
            {/* La vuelta al índice o a la colección padre en táctil */}
            {r.touch && <ListBackLink navigate={navigate} to={backTo} label={backLabel} />}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                paddingBottom: r.touch ? 22 : 30, marginBottom: r.touch ? 24 : 34,
                borderBottom: `1px solid ${T.hairline}`
            }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ overflowWrap: 'anywhere' }}>
                        <EditableTitle
                            value={list?.name ?? kindLabel}
                            fontSize={r.touch ? 26 : 34}
                            onSave={async (next) => { await LISTS.rename(kind, listId, next); }}
                        />
                    </div>
                    <div style={{
                        marginTop: 6,
                        fontFamily: T.ui, fontSize: 11, letterSpacing: 2.5,
                        textTransform: 'uppercase', color: T.dim
                    }}>
                        {kindLabel}
                        {count != null && ` · ${globalize.translate('ItemCount', count)}`}
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {kind === 'collection' && (
                        <PillButton
                            size='sm'
                            variant='ghost'
                            onClick={() => setCreateSub(true)}
                        >
                            + {globalize.translate('HeaderNewCollection')}
                        </PillButton>
                    )}
                    <ListCardMenu
                        kind={kind}
                        listId={listId}
                        title={list?.name}
                        logo={list?.logo}
                        onChanged={onCoverChanged}
                        onDeleted={() => navigate({ page: 'lists' })}
                        size={32}
                    />
                </div>
            </div>

            {createSub && (
                <CreateCollectionDialog
                    parentId={listId}
                    parentTitle={list?.name}
                    onClose={() => setCreateSub(false)}
                    onCreated={() => {
                        onCoverChanged();
                    }}
                />
            )}
        </>
    );
}

/** Los títulos de la lista, o el aviso de que no hay ninguno. */
function ListGrid({ items, error, navigate }: {
    items: PlaylistItem[] | null;
    error: string | null;
    navigate: Navigate;
}) {
    const r = useResponsive();

    return (
        <LoadState
            variant='page'
            loading={!items && !error}
            error={error}
            count={items ? items.length : undefined}
            emptyTitle={globalize.translate('MessageNoItemsFound')}
            emptyHint={globalize.translate('ListsEmpty')}
            emptyIcon='☰'
        >
            <CardGrid
                minWidth={r.touch ? (r.mobile ? 110 : 140) : 160}
                gap={r.touch ? `${r.gap + 6}px ${r.gap}px` : '28px 20px'}
            >
                {items?.map((item) => (
                    <ListItemCard key={item.id} item={item} navigate={navigate} />
                ))}
            </CardGrid>
        </LoadState>
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
    if (item.kind === 'collection') {
        return (
            <CollectionCard
                id={item.id}
                title={item.title}
                logo={item.logo}
                backdrop={item.backdrop}
                image={item.poster}
                onClick={() => navigate({ page: 'list', kind: 'collection', listId: item.id })}
                onChanged={() => {}}
            />
        );
    }
    return <MediaItemCard item={item} navigate={navigate} />;
}

function MediaItemCard({ item, navigate }: { item: PlaylistItem; navigate: Navigate }) {
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
                onClick: () => {
                    if (item.kind === 'movie') {
                        navigate({ page: 'movie', movieId: item.id });
                    } else {
                        navigate({ page: 'show', showId: item.seriesId ?? item.id });
                    }
                },
                selecting: false,
                selected: false,
                onContextMenu: ctx.onContextMenu,
                contextMenu: ctx.menu
            }}
        />
    );
}

