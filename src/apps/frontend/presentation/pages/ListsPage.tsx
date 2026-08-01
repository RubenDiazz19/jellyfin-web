import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { Nav } from '../components/layout/Nav';
import { EmptyState } from '../components/skeleton/Skeleton';
import { ListCardMenu } from '../components/controls/ListCardMenu';
import { LISTS, type ListRef } from '../../domain/stores';
import { MC, useResponsive } from '../theme/responsive';
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
            <section style={{
                background: r.touch ? MC.bg : '#000', color: r.touch ? MC.fg : '#fff',
                minHeight: '100vh',
                padding: r.touch ? `76px ${r.pagePad}px 48px` : '120px 56px 96px',
                fontFamily: T.ui
            }}>
                <h1 style={{
                    fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                    fontSize: r.touch ? 34 : 52, margin: '0 0 44px', letterSpacing: -0.5
                }}>
                    {globalize.translate('Lists')}
                </h1>

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
                                    subtitle={countLabel(l)}
                                    menu={<ListCardMenu kind={l.kind} listId={l.id} onChanged={refresh} />}
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
                                    subtitle={countLabel(l)}
                                    menu={<ListCardMenu kind={l.kind} listId={l.id} onChanged={refresh} />}
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
            </section>
        </>
    );
}

const routeFor = (l: ListRef): Route => ({ page: 'list', kind: l.kind, listId: l.id });

const countLabel = (l: ListRef) =>
    l.count != null ? globalize.translate('ItemCount', l.count) : undefined;

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
            <h3 style={{
                fontFamily: T.display, fontStyle: 'italic', fontSize: 26, fontWeight: 300,
                margin: '0 0 20px', letterSpacing: -0.3
            }}>
                {title}
            </h3>
            {empty ? (
                <div style={{ color: T.dim, fontSize: 13 }}>
                    {globalize.translate('ListsEmpty')}
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${r.touch ? 150 : 210}px, 1fr))`,
                    gap: r.touch ? 16 : 20
                }}>
                    {children}
                </div>
            )}
        </div>
    );
}

/**
 * Tarjeta de lista: solo la imagen, con todo encima.
 *
 * El nombre va en blanco y grande al centro, como en las tarjetas de
 * biblioteca — con la diferencia de que allí el rótulo viene QUEMADO en la
 * imagen que genera Jellyfin y aquí se pinta con CSS, que es lo que permite
 * cambiar la portada sin perder el título.
 *
 * No hay pie: repetir el nombre debajo no añadía nada y el rectángulo negro
 * partía la tarjeta en dos. El recuento y los tres puntos se superponen en las
 * esquinas de abajo.
 */
function ListCard({ title, subtitle, image, icon, menu, onClick }: {
    title: string;
    subtitle?: string;
    image?: string;
    icon?: string;
    menu?: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <div
            role='button'
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
            onMouseDown={(e) => e.preventDefault()}
            className='jfp-hoverlift'
            style={{
                cursor: 'pointer', fontFamily: T.ui, color: 'inherit',
                aspectRatio: '16/9', position: 'relative',
                borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${T.hairline}`,
                background: image ?
                    `url(${image}) center/cover` :
                    'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
                // La imagen se recorta al borde INTERIOR, que es justo hasta
                // donde llega la capa oscura de abajo (`inset: 0` cuenta desde
                // ahí). Sin esto, el fondo se pintaba también bajo el borde
                // —que es blanco translúcido y lo deja ver— y quedaba una
                // línea de un píxel sin oscurecer alrededor de la tarjeta,
                // muy visible por abajo, donde el degradado es más denso.
                backgroundClip: 'padding-box'
            }}
        >
            {/* Oscurece lo justo para que el rótulo se lea sobre cualquier
                fotograma, por claro que sea. Más marcado abajo, donde van el
                recuento y los puntos. */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.72) 100%)'
            }} />

            {/* La sombra va AQUÍ y no en el texto: el recorte a dos líneas
                necesita `overflow: hidden`, que corta también la sombra y
                dejaba un rectángulo visible alrededor del título, justo donde
                el desenfoque se cortaba en seco. `drop-shadow` sobre este
                contenedor —que no recorta nada— sigue la silueta de las letras
                y da el mismo resultado sin caja. */}
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

            {subtitle && (
                <span style={{
                    position: 'absolute', left: 12, bottom: 10,
                    fontSize: 11, fontStyle: 'italic',
                    color: 'rgba(255,255,255,0.8)',
                    textShadow: '0 1px 6px rgba(0,0,0,0.8)'
                }}>
                    {subtitle}
                </span>
            )}

            {menu && (
                <div style={{ position: 'absolute', right: 8, bottom: 8 }}>
                    {menu}
                </div>
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
