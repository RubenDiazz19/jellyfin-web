import { useEffect, useRef } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { Nav } from '../components/layout/Nav';
import { EmptyState } from '../components/skeleton/Skeleton';
import {
    searchVM, type StateFilter, type TypeFilter
} from '../../domain/viewModels/SearchViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

const TYPE_TABS: { id: TypeFilter; key: string }[] = [
    { id: 'todo', key: 'All' },
    { id: 'series', key: 'Shows' },
    { id: 'peliculas', key: 'Movies' }
];

const STATE_TABS: { id: StateFilter; key: string }[] = [
    { id: 'todo', key: 'All' },
    { id: 'favs', key: 'Favorites' },
    { id: 'vistos', key: 'Watched' },
    { id: 'no-vistos', key: 'Unwatched' }
];

export function SearchPage({ navigate }: { navigate: Navigate }) {
    // Todo el filtrado vive en SearchViewModel; la página solo pinta signals.
    useViewModel(searchVM);
    const r = useResponsive();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
    // start() re-filtra cuando cambian favoritos/vistos desde otro sitio;
    // load() trae la biblioteca real para buscar sobre ella.
        const stop = searchVM.start();
        void searchVM.load();
        const t = setTimeout(() => inputRef.current?.focus(), 80);
        return () => {
            stop();
            clearTimeout(t);
        };
    }, []);

    const query = searchVM.query.value;
    const typeFilter = searchVM.typeFilter.value;
    const stateFilter = searchVM.stateFilter.value;
    const q = query.trim();
    const filtered = searchVM.results.value;
    const anyFilterActive = searchVM.anyFilterActive.value;

    return (
        <div style={{
            minHeight: '100vh',
            background: r.touch ? MC.bg : '#0a0a0b',
            color: r.touch ? MC.fg : T.fg,
            fontFamily: T.ui
        }}>
            <Nav
                navigate={navigate}
                breadcrumb={[
                    { label: globalize.translate('Home'), to: { page: 'home' } },
                    { label: globalize.translate('Search') }
                ]}
            />

            <div style={{ padding: r.touch ? `72px ${r.pagePad}px 0` : '80px 64px 0' }}>
                <div style={{ position: 'relative', maxWidth: r.touch ? undefined : 720 }}>
                    <div style={{
                        position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                        color: T.dim, pointerEvents: 'none'
                    }}>
                        <Ic.Search size={r.touch ? 18 : 20} />
                    </div>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => searchVM.setQuery(e.target.value)}
                        placeholder={globalize.translate('SearchPlaceholder')}
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            background: r.touch ?
                                'var(--md-sys-color-surface-container-high, rgba(255,255,255,0.06))' :
                                'rgba(255,255,255,0.06)',
                            border: r.touch ? 'none' : '1px solid rgba(255,255,255,0.12)',
                            borderRadius: r.touch ? 'var(--md-sys-shape-corner-full, 28px)' : 12,
                            padding: r.touch ? '15px 18px 15px 50px' : '18px 20px 18px 52px',
                            color: 'inherit', fontFamily: T.ui,
                            fontSize: r.touch ? 16 : 18, outline: 'none',
                            transition: 'border-color .2s'
                        }}
                        onFocus={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.35)')}
                        onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                    />
                    {query && (
                        <button
                            type='button'
                            onClick={searchVM.clearQuery}
                            aria-label={globalize.translate('Clear')}
                            style={{
                                position: 'absolute', right: 10, top: '50%',
                                transform: 'translateY(-50%)', cursor: 'pointer',
                                color: T.dim, fontSize: 20, lineHeight: 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, padding: 0,
                                background: 'none', border: 'none', borderRadius: '50%',
                                fontFamily: T.ui
                            }}
                        >
                            <span aria-hidden='true'>✕</span>
                        </button>
                    )}
                </div>

                <FilterRow<TypeFilter>
                    label={globalize.translate('LabelType')}
                    tabs={TYPE_TABS}
                    active={typeFilter}
                    onChange={searchVM.setTypeFilter}
                />
                <FilterRow<StateFilter>
                    label={globalize.translate('LabelStatus')}
                    tabs={STATE_TABS}
                    active={stateFilter}
                    onChange={searchVM.setStateFilter}
                />
            </div>

            <div style={{ padding: r.touch ? `24px ${r.pagePad}px 56px` : '36px 64px 80px' }}>
                {filtered.length === 0 ? (
                    q ? (
                        <EmptyState
                            title={globalize.translate('SearchNoResultsFor', query)}
                            hint={globalize.translate('SearchNoResultsForHelp')}
                            icon='⌕'
                        />
                    ) : anyFilterActive ? (
                        <EmptyState
                            title={globalize.translate('SearchNoResultsFilters')}
                            hint={globalize.translate('SearchNoResultsFiltersHelp')}
                            icon='⌕'
                        />
                    ) : (
                        <EmptyState
                            title={globalize.translate('SearchStartTyping')}
                            hint={globalize.translate('SearchStartTypingHelp')}
                            icon='⌕'
                        />
                    )
                ) : (
                    <>
                        <div style={{
                            fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
                            color: T.dim, marginBottom: 28
                        }}>
                            {q || anyFilterActive ?
                                globalize.translate('SearchResultsCount', filtered.length) :
                                globalize.translate('HeaderMyLibrary')}
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fill, minmax(${r.touch ? (r.mobile ? 110 : 140) : 160}px, 1fr))`,
                            gap: r.touch ? `${r.gap + 6}px ${r.gap}px` : '28px 20px'
                        }}>
                            {filtered.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() =>
                                        navigate(item._type === 'show' ?
                                            { page: 'show', showId: item.id } :
                                            { page: 'movie', movieId: item.id })
                                    }
                                    style={{ cursor: 'pointer' }}
                                    className='jfp-hoverlift'
                                >
                                    <div style={{
                                        aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', position: 'relative',
                                        background: 'rgba(255,255,255,0.05)',
                                        backgroundImage: item.poster ?
                                            `url(${item.poster})` :
                                            item.backdrop ? `url(${item.backdrop})` : 'none',
                                        backgroundSize: 'cover', backgroundPosition: 'center'
                                    }}>
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)'
                                        }} />
                                        <div style={{ position: 'absolute', top: 8, left: 10 }}>
                                            <span style={{
                                                fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                                                color: 'rgba(255,255,255,0.55)',
                                                background: 'rgba(0,0,0,0.5)',
                                                padding: '3px 7px', borderRadius: 4
                                            }}>
                                                {globalize.translate(item._type === 'show' ? 'Series' : 'Movie')}
                                            </span>
                                        </div>
                                        {!item.poster && !item.backdrop && (
                                            <div style={{
                                                position: 'absolute', inset: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontFamily: T.display, fontSize: 32,
                                                color: 'rgba(255,255,255,0.15)'
                                            }}>
                                                {item.title?.[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ marginTop: 10 }}>
                                        <div style={{
                                            fontFamily: T.ui, fontSize: 14, fontWeight: 500,
                                            lineHeight: 1.3, marginBottom: 4
                                        }}>
                                            {item.title}
                                        </div>
                                        <div style={{ fontSize: 11, color: T.dim }}>
                                            {item.year}{item.genres?.[0] ? ` · ${item.genres[0]}` : ''}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Chip row genérico para las dos dimensiones del filtro (tipo/estado).
function FilterRow<T extends string>({
    label, tabs, active, onChange
}: {
    label: string;
    tabs: { id: T; key: string }[];
    active: T;
    onChange: (v: T) => void;
}) {
    const r = useResponsive();
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: r.touch ? 14 : 20 }}>
            {!r.mobile && (
                <span style={{
                    fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
                    color: T.dim, minWidth: 60
                }}>
                    {label}
                </span>
            )}
            <div style={{
                display: 'flex', gap: 8,
                overflowX: r.touch ? 'auto' : undefined,
                scrollbarWidth: r.touch ? 'none' : undefined,
                paddingBottom: r.touch ? 2 : undefined
            }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        style={{
                            padding: '7px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                            fontFamily: T.ui, fontSize: 13, fontWeight: 500, transition: 'all .15s',
                            background: active === tab.id ? T.fg : 'rgba(255,255,255,0.08)',
                            color: active === tab.id ? '#000' : T.dim
                        }}
                    >
                        {globalize.translate(tab.key)}
                    </button>
                ))}
            </div>
        </div>
    );
}
