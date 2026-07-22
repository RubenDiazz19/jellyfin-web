import React from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useScrollY } from '../../../domain/bridge/useScrollY';
import { FavButton } from '../controls/FavButton';
import { WatchedButton } from '../controls/WatchedButton';
import { MovieWatchedButton } from '../controls/MovieWatchedButton';
import { ShowNavWatchedButton } from '../controls/ShowNavWatchedButton';
import { UserAvatar } from './UserAvatar';
import { useResponsive } from '../../theme/responsive';
import type { Movie } from '../../../domain/models';
import type { Route } from '../../../app/router';

type Crumb = { label: string; to?: Route };
type ActionData =
  | { type: 'show'; id: string }
  | { type: 'movie'; movie: Movie }
  | { type: 'episode'; id: string };

type NavProps = {
    navigate: (r: Route) => void;
    active?: 'home' | 'series' | 'movies' | 'favorites';
    breadcrumb?: Crumb[];
    actionId?: string;
    actionData?: ActionData;
};

const NAV_LINKS = [
    { id: 'home', label: 'Inicio' },
    { id: 'series', label: 'Series' },
    { id: 'movies', label: 'Películas' },
    { id: 'favorites', label: 'Favoritos' }
] as const;

// Reset para que un <button> real (accesible con teclado) se vea como los
// antiguos spans clicables.
const linkReset: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, margin: 0,
    font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
    cursor: 'pointer'
};

export function Nav({ navigate, active = 'home', breadcrumb, actionId, actionData }: NavProps) {
    const y = useScrollY();
    const scrolled = y > 80;
    const r = useResponsive();

    // Mobile/tablet: barra superior slim — solo logo, acciones del item y
    // avatar. Los enlaces y la lupa viven en la navegación M3 inferior/rail.
    if (r.touch) {
        return (
            <div data-jfp-nav='' style={{
                position: 'fixed', top: 0, right: 0, zIndex: 50,
                left: r.tablet ? 'calc(88px + env(safe-area-inset-left, 0px))' : 0,
                padding: `calc(10px + env(safe-area-inset-top, 0px)) ${r.pagePad + 4}px 10px`,
                display: 'flex', alignItems: 'center', gap: 14,
                fontFamily: T.ui, fontSize: 13,
                background: scrolled ? 'var(--md-sys-color-surface, rgba(0,0,0,0.65))' : 'transparent',
                borderBottom: scrolled ?
                    '1px solid var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))' :
                    '1px solid transparent',
                transition: 'background .25s, border-color .25s'
            }}>
                <button
                    onClick={() => navigate({ page: 'home' })}
                    style={{
                        ...linkReset,
                        fontFamily: T.display, fontStyle: 'italic', fontSize: 19, letterSpacing: 0.5,
                        color: 'var(--md-sys-color-on-surface, #fff)'
                    }}
                >
                    jellyfin
                </button>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    color: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.55))',
                    marginLeft: 'auto'
                }}>
                    {actionId && (
                        <>
                            <FavButton id={actionId} size={17} />
                            {actionData?.type === 'show' ? (
                                <ShowNavWatchedButton showId={actionData.id} size={17} />
                            ) : actionData?.type === 'movie' ? (
                                <MovieWatchedButton movie={actionData.movie} size={17} />
                            ) : (
                                <WatchedButton
                                    id={actionId}
                                    serverId={actionData?.type === 'episode' ? actionData.id : undefined}
                                    size={17}
                                />
                            )}
                        </>
                    )}
                    <UserAvatar navigate={navigate} />
                </div>
            </div>
        );
    }

    return (
        <div data-jfp-nav='' style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            padding: '20px 24px 20px 56px',
            display: 'flex', alignItems: 'center', gap: 44,
            fontFamily: T.ui, fontSize: 13, letterSpacing: 0.2,
            background: scrolled ? 'rgba(0,0,0,0.65)' : 'transparent',
            backdropFilter: scrolled ? 'blur(16px) saturate(180%)' : 'none',
            WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(180%)' : 'none',
            borderBottom: scrolled ? `1px solid ${T.hairline}` : '1px solid transparent',
            transition: 'background .25s, border-color .25s, backdrop-filter .25s'
        }}>
            <button
                onClick={() => navigate({ page: 'home' })}
                style={{
                    ...linkReset,
                    fontFamily: T.display, fontStyle: 'italic', fontSize: 22, letterSpacing: 0.5,
                    color: T.fg
                }}
            >
                jellyfin
            </button>

            {breadcrumb ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: T.dim, fontSize: 12, flex: 1 }}>
                    {breadcrumb.map((b, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
                            {b.to ? (
                                <button
                                    onClick={() => navigate(b.to as Route)}
                                    style={{
                                        ...linkReset,
                                        color: i === breadcrumb.length - 1 ? T.fg : T.dim
                                    }}
                                >
                                    {b.label}
                                </button>
                            ) : (
                                <span style={{ color: i === breadcrumb.length - 1 ? T.fg : T.dim }}>
                                    {b.label}
                                </span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', gap: 26, flex: 1 }}>
                    {NAV_LINKS.map((l) => (
                        <button
                            key={l.id}
                            onClick={() => navigate(l.id === 'home' ? { page: 'home' } : { page: l.id })}
                            style={{
                                ...linkReset,
                                color: l.id === active ? T.fg : T.dim,
                                fontWeight: l.id === active ? 500 : 400,
                                position: 'relative'
                            }}
                        >
                            {l.label}
                            {l.id === active && (
                                <div style={{ position: 'absolute', bottom: -6, left: 0, right: 0, height: 1, background: T.fg }} />
                            )}
                        </button>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: T.dim, marginLeft: 'auto' }}>
                {actionId && (
                    <>
                        <FavButton id={actionId} size={17} />
                        {actionData?.type === 'show' ? (
                            <ShowNavWatchedButton showId={actionData.id} size={17} />
                        ) : actionData?.type === 'movie' ? (
                            <MovieWatchedButton movie={actionData.movie} size={17} />
                        ) : (
                            <WatchedButton
                                id={actionId}
                                serverId={actionData?.type === 'episode' ? actionData.id : undefined}
                                size={17}
                            />
                        )}
                        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.18)' }} />
                    </>
                )}
                <button
                    onClick={() => navigate({ page: 'search' })}
                    aria-label='Buscar'
                    style={{
                        ...linkReset, display: 'flex', alignItems: 'center',
                        padding: '4px 6px', borderRadius: 6, transition: 'background .15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <Ic.Search size={16} />
                </button>
                <UserAvatar navigate={navigate} />
            </div>
        </div>
    );
}
