import { useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { Nav } from '../components/layout/Nav';
import { EmptyState } from '../components/skeleton/Skeleton';
import { ListCardMenu, type ListMenuHandle } from '../components/controls/ListCardMenu';
import { PageSection } from '../components/layout/PageSection';
import { CardGrid } from '../components/layout/CardGrid';
import { PageTitle, SectionTitle } from '../components/layout/Title';
import { LISTS, type ListKind, type ListRef } from '../../domain/stores';
import { useResponsive } from '../theme/responsive';
import type { Navigate, Route } from '../../app/router';

type Props = { navigate: Navigate };

// Índice de listas: de reproducción y colecciones, más Favoritos.
//
// Los tres tipos conviven aquí a propósito, aunque por dentro sean cosas
// distintas —Favoritos vive en un store local, y las colecciones guardan las
// series enteras mientras las listas de reproducción las desmenuzan en
// capítulos—. Para el usuario todas son «una lista donde meto títulos», y esa
// es la unidad que interesa al navegar.

export function ListsPage({ navigate }: Props) {
    const r = useResponsive();
    const [lists, setLists] = useState<ListRef[]>(() => LISTS.all());
    const [loading, setLoading] = useState(() => LISTS.all().length === 0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const sync = () => setLists(LISTS.all());
        window.addEventListener(LISTS.event, sync);
        LISTS.refresh()
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
        return () => window.removeEventListener(LISTS.event, sync);
    }, []);

    // Tras cambiar un fondo el store ya emite su evento, pero la marca de
    // «fondo propio» vive en localStorage y no lo dispara: se re-lee a mano.
    const refresh = () => setLists(LISTS.all());

    const playlists = lists.filter((l) => l.kind === 'playlist');
    const collections = lists.filter((l) => l.kind === 'collection');

    return (
        <>
            <Nav navigate={navigate} active='lists' />
            <PageSection>
                <PageTitle margin='0 0 44px'>{globalize.translate('Lists')}</PageTitle>

                {error ? (
                    <EmptyState title={globalize.translate('MessageNoPlaylistsYet')} hint={error} />
                ) : (
                    // Los tres bloques van EN COLUMNAS, no apilados: con una o
                    // dos listas por bloque, apilarlos dejaba media pantalla en
                    // blanco a la derecha y obligaba a bajar para ver las
                    // colecciones. `auto-fit` los vuelve a apilar solo cuando
                    // no caben, así que en móvil se comporta como antes.
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: r.touch ? 32 : 44,
                        alignItems: 'start'
                    }}>
                        <Group title={globalize.translate('Favorites')}>
                            {/* Favoritos siempre: existe aunque esté vacío, así
                                que no depende de que carguen las demás. Sin
                                menú: no es una lista del servidor, no tiene
                                portada que cambiar. */}
                            <ListCard
                                title={globalize.translate('Favorites')}
                                icon='♥'
                                onClick={() => navigate({ page: 'favorites' })}
                            />
                        </Group>

                        <Group title={globalize.translate('Playlists')} empty={playlists.length === 0}>
                            {playlists.map((l) => (
                                <ListCard
                                    key={l.id}
                                    title={l.name}
                                    image={l.image}
                                    cover={{ kind: l.kind, listId: l.id, onChanged: refresh }}
                                    onClick={() => navigate(routeFor(l))}
                                />
                            ))}
                        </Group>

                        <Group title={globalize.translate('Collections')} empty={collections.length === 0}>
                            {collections.map((l) => (
                                <ListCard
                                    key={l.id}
                                    title={l.name}
                                    image={l.image}
                                    cover={{ kind: l.kind, listId: l.id, onChanged: refresh }}
                                    onClick={() => navigate(routeFor(l))}
                                />
                            ))}
                        </Group>
                    </div>
                )}

                {!loading && !error && lists.length === 0 && (
                    <div style={{ marginTop: 28, color: T.dim, fontSize: 13 }}>
                        {globalize.translate('ListsEmpty')}
                    </div>
                )}
            </PageSection>
        </>
    );
}

const routeFor = (l: ListRef): Route => ({ page: 'list', kind: l.kind, listId: l.id });

/**
 * Un bloque del índice, pensado para vivir en una columna. Se pinta aunque
 * esté vacío, con su aviso: así las tres columnas siempre están, y se ve de un
 * vistazo que existen las colecciones aunque no tengas ninguna.
 *
 * Dentro, las tarjetas vuelven a repartirse en rejilla si la columna es ancha
 * —con una sola lista la columna ocuparía todo el hueco disponible— pero con
 * un mínimo menor que el de la columna, para que no se estiren.
 */
function Group({ title, empty, children }: {
    title: string; empty?: boolean; children: React.ReactNode;
}) {
    const r = useResponsive();
    return (
        <div>
            <SectionTitle>{title}</SectionTitle>
            {empty ? (
                <div style={{ color: T.dim, fontSize: 13 }}>
                    {globalize.translate('ListsEmpty')}
                </div>
            ) : (
                <CardGrid minWidth={r.touch ? 150 : 210} gap={r.touch ? 16 : 20}>
                    {children}
                </CardGrid>
            )}
        </div>
    );
}

/**
 * Tarjeta de lista: la imagen y nada más.
 *
 * Ni rótulo, ni recuento, ni tres puntos encima. La portada de una lista es
 * una imagen elegida a mano —casi siempre con el nombre dentro, como el de la
 * colección de Marvel— y taparla con los mismos datos que ya se ven al entrar
 * no aportaba nada. El nombre sigue existiendo: es el nombre accesible de la
 * tarjeta, se lee al pasar por encima y se edita dentro de la lista.
 *
 * SIN imagen sí se escribe, porque si no la tarjeta sería un rectángulo vacío
 * imposible de distinguir de la de al lado. Es el caso de Favoritos y el de
 * una lista recién creada.
 *
 * El menú de la portada se abre con el clic derecho, como en el hero.
 */
function ListCard({ title, image, icon, cover, onClick }: {
    title: string;
    image?: string;
    icon?: string;
    /** Con él, el clic derecho abre el menú de la portada. */
    cover?: { kind: ListKind; listId: string; onChanged: () => void };
    onClick: () => void;
}) {
    const menu = useRef<ListMenuHandle | null>(null);
    return (
        <div
            role='button'
            tabIndex={0}
            aria-label={title}
            title={title}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
            onMouseDown={(e) => e.preventDefault()}
            onContextMenu={cover ? (e) => {
                e.preventDefault();
                menu.current?.openAt(e.clientX, e.clientY);
            } : undefined}
            className='jfp-hoverlift'
            style={{
                cursor: 'pointer', fontFamily: T.ui, color: 'inherit',
                aspectRatio: '16/9', position: 'relative',
                borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${T.hairline}`,
                background: image ?
                    `url(${image}) center/cover` :
                    'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
                // La imagen se recorta al borde INTERIOR. Sin esto, el fondo se
                // pintaba también bajo el borde —que es blanco translúcido y lo
                // deja ver— y quedaba una línea de un píxel alrededor.
                backgroundClip: 'padding-box'
            }}
        >
            {!image && (
                // La sombra va en el contenedor y no en el texto: el recorte a
                // dos líneas necesita `overflow: hidden`, que corta también la
                // sombra y dejaba un rectángulo visible alrededor del título.
                <div style={{
                    position: 'absolute', inset: 0, padding: '0 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center',
                    filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.8))'
                }}>
                    <span style={{
                        fontSize: 'clamp(20px, 2.2vw, 30px)', fontWeight: 700, lineHeight: 1.1,
                        color: '#fff',
                        overflow: 'hidden',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                    }}>
                        {icon ? `${icon} ${title}` : title}
                    </span>
                </div>
            )}

            {cover && (
                <ListCardMenu
                    hideTrigger
                    handle={menu}
                    kind={cover.kind}
                    listId={cover.listId}
                    onChanged={cover.onChanged}
                />
            )}
        </div>
    );
}

/** Cabecera compartida por Favoritos y las listas: vuelta atrás al índice. */
export function ListBackLink({ navigate }: { navigate: Navigate }) {
    const to: Route = { page: 'lists' };
    return (
        <button
            onClick={() => navigate(to)}
            onMouseDown={(e) => e.preventDefault()}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', padding: 0, marginBottom: 18,
                color: T.dim, fontFamily: T.ui, fontSize: 13, cursor: 'pointer'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.dim)}
        >
            <Ic.Arrow size={14} /> {globalize.translate('Lists')}
        </button>
    );
}
