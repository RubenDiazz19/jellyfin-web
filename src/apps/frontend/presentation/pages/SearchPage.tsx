import { useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { Nav } from '../components/layout/Nav';
import { SearchResultCard } from '../components/cards/SearchResultCard';
import { SelectionBar } from '../components/controls/SelectionBar';
import { EmptyState } from '../components/skeleton/Skeleton';
import { useToast } from '../components/toast/ToastProvider';
import {
    NO_TAG, searchVM, type StateFilter, type TypeFilter
} from '../../domain/viewModels/SearchViewModel';
import {
    selectionVM, type SelectableItem
} from '../../domain/viewModels/SelectionViewModel';
import { VIEWS, type SavedView } from '../../domain/stores';
import { useViewModel, useVmSignals } from '../../domain/bridge/useViewModel';
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
            // Salir de la búsqueda no debe dejar una selección viva.
            selectionVM.stop();
        };
    }, []);

    const query = searchVM.query.value;
    const typeFilter = searchVM.typeFilter.value;
    const stateFilter = searchVM.stateFilter.value;
    const tagFilter = searchVM.tagFilter.value;
    const allTags = searchVM.allTags.value;
    const selectable: SelectableItem[] = searchVM.results.value.map((i) => ({
        id: i.id, title: i.title, kind: i._type, poster: i.poster, year: i.year
    }));
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
                {/* Sin etiquetas en la biblioteca la fila sobra: no se pinta. */}
                {allTags.length > 0 && (
                    <FilterRow<string>
                        label={globalize.translate('Tags')}
                        tabs={[
                            { id: NO_TAG, key: 'All' },
                            ...allTags.map((tag) => ({ id: tag, label: tag }))
                        ]}
                        active={tagFilter}
                        onChange={searchVM.setTagFilter}
                    />
                )}
                <SavedViewsRow />
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
                            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28
                        }}>
                            <div style={{
                                fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
                                color: T.dim
                            }}>
                                {q || anyFilterActive ?
                                    globalize.translate('SearchResultsCount', filtered.length) :
                                    globalize.translate('HeaderMyLibrary')}
                            </div>
                            <SelectToggle />
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fill, minmax(${r.touch ? (r.mobile ? 110 : 140) : 160}px, 1fr))`,
                            gap: r.touch ? `${r.gap + 6}px ${r.gap}px` : '28px 20px'
                        }}>
                            {filtered.map((item) => (
                                <SearchResultCard key={item.id} item={item} navigate={navigate} />
                            ))}
                        </div>
                    </>
                )}
            </div>
            <SelectionBar items={selectable} />
        </div>
    );
}

/** Entra y sale del modo selección. */
function SelectToggle() {
    useVmSignals(selectionVM, (vm) => [vm.selecting]);
    const on = selectionVM.selecting.value;
    return (
        <button
            onClick={() => (on ? selectionVM.stop() : selectionVM.start())}
            style={{
                marginLeft: 'auto', padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                background: on ? '#fff' : 'rgba(255,255,255,0.08)',
                color: on ? '#000' : T.dim,
                border: on ? 'none' : '1px solid rgba(255,255,255,0.15)',
                fontFamily: T.ui, fontSize: 12
            }}
        >
            {globalize.translate(on ? 'ButtonCancel' : 'SelectItems')}
        </button>
    );
}

/**
 * Vistas guardadas: un chip por vista más «guardar actual». La fila aparece
 * en cuanto hay una vista o hay filtros que valga la pena guardar, para no
 * ocupar sitio en la pantalla de búsqueda recién abierta.
 */
function SavedViewsRow() {
    const r = useResponsive();
    const [views, setViews] = useState<SavedView[]>(() => VIEWS.all());
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const toast = useToast();
    const anyFilterActive = searchVM.anyFilterActive.value;

    useEffect(() => {
        const sync = () => setViews(VIEWS.all());
        window.addEventListener(VIEWS.event, sync);
        return () => window.removeEventListener(VIEWS.event, sync);
    }, []);

    if (views.length === 0 && !anyFilterActive) return null;

    const save = () => {
        const clean = name.trim();
        if (!clean) return;
        VIEWS.save(searchVM.currentView(clean));
        toast(globalize.translate('MessageViewSaved'), 'success');
        setName('');
        setNaming(false);
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: r.touch ? 14 : 20
        }}>
            {!r.mobile && (
                <span style={{
                    fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
                    color: T.dim, minWidth: 60
                }}>
                    {globalize.translate('HeaderMyViews')}
                </span>
            )}
            <div style={{
                display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'
            }}>
                {views.map((v) => (
                    <span
                        key={v.id}
                        style={{
                            display: 'inline-flex', alignItems: 'center',
                            borderRadius: 999, background: 'rgba(255,255,255,0.08)'
                        }}
                    >
                        <button
                            onClick={() => searchVM.applyView(v)}
                            style={{
                                padding: '7px 8px 7px 16px', border: 'none', background: 'none',
                                color: T.dim, fontFamily: T.ui, fontSize: 13, cursor: 'pointer'
                            }}
                        >
                            {v.name}
                        </button>
                        <button
                            onClick={() => VIEWS.remove(v.id)}
                            aria-label={`${globalize.translate('Delete')} ${v.name}`}
                            style={{
                                padding: '0 12px 0 4px', border: 'none', background: 'none',
                                color: T.dim, fontSize: 14, lineHeight: 1, cursor: 'pointer'
                            }}
                        >×</button>
                    </span>
                ))}

                {naming ? (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') save();
                                if (e.key === 'Escape') setNaming(false);
                            }}
                            placeholder={globalize.translate('LabelViewName')}
                            style={{
                                background: 'rgba(255,255,255,0.06)', color: 'inherit',
                                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999,
                                padding: '6px 14px', fontFamily: T.ui, fontSize: 13, outline: 'none'
                            }}
                        />
                        <button
                            onClick={save}
                            style={{
                                padding: '6px 14px', borderRadius: 999, border: 'none',
                                background: '#fff', color: '#000',
                                fontFamily: T.ui, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            {globalize.translate('Save')}
                        </button>
                    </span>
                ) : anyFilterActive && (
                    <button
                        onClick={() => setNaming(true)}
                        style={{
                            padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
                            background: 'none', color: T.dim,
                            border: '1px dashed rgba(255,255,255,0.25)',
                            fontFamily: T.ui, fontSize: 13
                        }}
                    >
                        + {globalize.translate('SaveCurrentView')}
                    </button>
                )}
            </div>
        </div>
    );
}

// Chip row genérico para las dimensiones del filtro (tipo, estado, etiquetas).
// Un chip lleva o `key` (clave a traducir, para las opciones fijas) o `label`
// (texto tal cual, para las etiquetas: las escribe el usuario y no se traducen).
type Chip<T extends string> =
    | { id: T; key: string; label?: never }
    | { id: T; label: string; key?: never };

function FilterRow<T extends string>({
    label, tabs, active, onChange
}: {
    label: string;
    tabs: Chip<T>[];
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
                // En touch la fila hace scroll horizontal (gesto natural); en
                // escritorio no hay ese gesto, así que envuelve. Sin esto los
                // chips que no caben en una línea quedaban fuera del
                // viewport y no había forma de alcanzarlos con el ratón.
                flexWrap: r.touch ? 'nowrap' : 'wrap',
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
                        {tab.key ? globalize.translate(tab.key) : tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
