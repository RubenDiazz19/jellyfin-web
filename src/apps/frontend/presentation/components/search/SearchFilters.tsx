// Filas de filtro de la búsqueda:
// 1. En reposo se muestran las 3 píldoras principales: Tipo, Estado y Géneros.
// 2. Al seleccionar una categoría, las otras dos desaparecen y sus subcategorías
//    se despliegan en la misma línea a la derecha con scroll horizontal.
// 3. La caja de búsqueda principal pasa a filtrar las subcategorías activas.
//
// Vive aparte de SearchPage porque lo usan dos sitios —la página /search y la
// superposición que abre la lupa— y son exactamente los mismos filtros sobre
// el mismo ViewModel.

import React, { useEffect, useMemo, useRef, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { useToast } from '../toast/ToastProvider';
import { searchVM, type FilterCategory, type StateFilter, type TypeFilter } from '../../../domain/viewModels/SearchViewModel';
import { PRIMARY_GENRES, getItemGenres } from '../../../domain/genres';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import { VIEWS, type SavedView } from '../../../domain/stores';
import { AddFilterButton, MainPill, OptionPill } from './SearchPills';
import { RatingFilterBar } from './RatingFilterBar';

const TYPE_OPTIONS: { id: TypeFilter; key: string }[] = [
    { id: 'series', key: 'Shows' },
    { id: 'peliculas', key: 'Movies' },
    { id: 'colecciones', key: 'Collections' }
];

const STATE_OPTIONS: { id: StateFilter; key: string }[] = [
    { id: 'favs', key: 'Favorites' },
    { id: 'vistos', key: 'Watched' },
    { id: 'no-vistos', key: 'Unwatched' }
];

export function SearchFilters() {
    useVmSignals(searchVM, (vm) => [
        vm.categoryMode,
        vm.categoryQuery,
        vm.typeFilters,
        vm.stateFilters,
        vm.tagFilters,
        vm.ratingFilters,
        vm.availableTags,
        vm.anyFilterActive
    ]);
    const r = useResponsive();
    const categoryMode = searchVM.categoryMode.value;
    const categoryQuery = searchVM.categoryQuery.value.trim().toLowerCase();
    const [isPickingCategory, setIsPickingCategory] = useState(false);
    const scrollRowRef = useRef<HTMLDivElement>(null);

    const typeCount = searchVM.typeFilters.value.length;
    const stateCount = searchVM.stateFilters.value.length;
    const tagCount = searchVM.tagFilters.value.length;
    const ratingFilters = searchVM.ratingFilters.value;
    const ratingCount = ratingFilters.length;
    const availableTags = searchVM.availableTags.value;
    const activeTags = searchVM.tagFilters.value;

    const filteredTypeOptions = TYPE_OPTIONS.filter((opt) =>
        !categoryQuery || globalize.translate(opt.key).toLowerCase().includes(categoryQuery)
    );

    const filteredStateOptions = STATE_OPTIONS.filter((opt) =>
        !categoryQuery || globalize.translate(opt.key).toLowerCase().includes(categoryQuery)
    );

    // Las etiquetas seleccionadas van primero para facilitar desmarcarlas;
    // al desmarcarse vuelven a su orden alfabético natural.
    // Solo se muestran las etiquetas disponibles en los resultados actuales (evita 0 resultados).
    const filteredTags = useMemo(() => {
        const activeSet = new Set(activeTags.map((t) => t.toLowerCase()));
        const matching = availableTags.filter((tag) =>
            activeSet.has(tag.toLowerCase()) || !categoryQuery || tag.toLowerCase().includes(categoryQuery)
        );
        return [...matching].sort((a, b) => {
            const aSelected = activeSet.has(a.toLowerCase());
            const bSelected = activeSet.has(b.toLowerCase());
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return a.localeCompare(b);
        });
    }, [availableTags, categoryQuery, activeTags]);

    const categories: { id: FilterCategory; label: string; count: number }[] = [
        { id: 'tipo', label: globalize.translate('LabelType'), count: typeCount },
        { id: 'estado', label: globalize.translate('LabelStatus'), count: stateCount },
        { id: 'generos', label: globalize.translate('Genres'), count: tagCount },
        { id: 'valoracion', label: globalize.translate('Rating'), count: ratingCount }
    ];

    return (
        <div style={{ marginTop: r.touch ? 14 : 20 }}>

            {/* Fila principal en una sola línea */}
            <div
                ref={scrollRowRef}
                style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    WebkitOverflowScrolling: 'touch',
                    paddingBottom: 2
                }}
            >
                {/* Caso A: Ninguna categoría abierta -> Mostrar las 4 píldoras principales */}
                {categoryMode === null && (
                    <div style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        animation: 'jfpPillsFadeIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both'
                    }}>
                        {categories.map((cat) => (
                            <MainPill
                                key={cat.id}
                                label={cat.label}
                                count={cat.count}
                                isOpen={false}
                                onClick={() => {
                                    setIsPickingCategory(false);
                                    searchVM.openCategory(cat.id);
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Caso B: Una categoría seleccionada -> Mostrarla a la izquierda con sus hijos, y el botón + para anidar otras categorías */}
                {categoryMode !== null && (
                    <>
                        {/* Píldora padre seleccionada */}
                        {(() => {
                            const activeCat = categories.find((c) => c.id === categoryMode);
                            if (!activeCat) return null;
                            return (
                                <MainPill
                                    label={activeCat.label}
                                    count={activeCat.count}
                                    isOpen={true}
                                    onClick={() => {
                                        setIsPickingCategory(false);
                                        searchVM.closeCategory();
                                    }}
                                />
                            );
                        })()}

                        {/* Divisor vertical sutil */}
                        <div style={{
                            width: 1,
                            height: 20,
                            background: 'rgba(255,255,255,0.18)',
                            flexShrink: 0,
                            margin: '0 2px'
                        }} />

                        {/* Tira horizontal de subcategorías con entrada progresiva */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexShrink: 0
                            }}
                        >
                            {(() => {
                                if (categoryMode === 'valoracion') return <RatingFilterBar />;

                                let activeOptions: { id: string; label: string; selected: boolean; toggle: () => void }[] | null = null;
                                if (categoryMode === 'tipo') {
                                    activeOptions = filteredTypeOptions.map(opt => ({
                                        id: opt.id,
                                        label: globalize.translate(opt.key),
                                        selected: searchVM.hasTypeFilter(opt.id),
                                        toggle: () => searchVM.toggleTypeFilter(opt.id)
                                    }));
                                } else if (categoryMode === 'estado') {
                                    activeOptions = filteredStateOptions.map(opt => ({
                                        id: opt.id,
                                        label: globalize.translate(opt.key),
                                        selected: searchVM.hasStateFilter(opt.id),
                                        toggle: () => searchVM.toggleStateFilter(opt.id)
                                    }));
                                } else if (categoryMode === 'generos') {
                                    const results = searchVM.results.value;
                                    const activeGenresSet = new Set(
                                        results.flatMap(item => getItemGenres(item as any))
                                               .map(g => g.toLowerCase())
                                    );

                                    const availableGenres = PRIMARY_GENRES.filter(g => {
                                        if (categoryQuery && !g.toLowerCase().includes(categoryQuery)) return false;
                                        // Con 1 resultado o menos, las opciones no seleccionadas no acotan nada
                                        if (results.length <= 1 && !searchVM.hasTagFilter(g)) return false;
                                        return searchVM.hasTagFilter(g) || activeGenresSet.has(g.toLowerCase());
                                    });

                                    const genreOptions = availableGenres.map(g => ({
                                        id: g,
                                        label: g,
                                        selected: searchVM.hasTagFilter(g),
                                        toggle: () => {
                                            const isSelecting = !searchVM.hasTagFilter(g);
                                            searchVM.toggleTagFilter(g);
                                            if (isSelecting) scrollRowRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                                        }
                                    })).sort((a, b) => {
                                        // Seleccionados primero; al desmarcar vuelven a su orden original
                                        if (a.selected && !b.selected) return -1;
                                        if (!a.selected && b.selected) return 1;
                                        return 0;
                                    });

                                    const tagOptions = filteredTags
                                        .filter(tag => !PRIMARY_GENRES.includes(tag))
                                        .map(tag => ({
                                            id: tag,
                                            label: tag,
                                            selected: searchVM.hasTagFilter(tag),
                                            toggle: () => {
                                                const isSelecting = !searchVM.hasTagFilter(tag);
                                                searchVM.toggleTagFilter(tag);
                                                if (isSelecting) scrollRowRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                                            }
                                        }));

                                    activeOptions = [...genreOptions, ...tagOptions];
                                }

                                if (!activeOptions) return null;

                                if (activeOptions.length === 0) {
                                    return (
                                        <span style={{ fontSize: 12, color: T.dim, whiteSpace: 'nowrap', padding: '6px 12px' }}>
                                            {globalize.translate('MessageNoResults')}
                                        </span>
                                    );
                                }

                                if (categoryMode === 'generos') {
                                    const genresList = activeOptions.filter(opt => PRIMARY_GENRES.includes(opt.id));
                                    const tagsList = activeOptions.filter(opt => !PRIMARY_GENRES.includes(opt.id));

                                    // Separar seleccionadas (fijas) de no seleccionadas (en scroll)
                                    const selectedGenres = genresList.filter(opt => opt.selected);
                                    const unselectedGenres = genresList.filter(opt => !opt.selected);
                                    const selectedTags = tagsList.filter(opt => opt.selected);
                                    const unselectedTags = tagsList.filter(opt => !opt.selected);

                                    return (
                                        <>
                                            {/* Géneros seleccionados: siempre visibles fuera del scroll */}
                                            {selectedGenres.map((opt) => (
                                                <OptionPill
                                                    key={opt.id}
                                                    index={0}
                                                    label={opt.label}
                                                    selected
                                                    onClick={opt.toggle}
                                                    animateIn={false}
                                                />
                                            ))}
                                            {unselectedGenres.length > 0 && (
                                                <ScrollableFilterGroup>
                                                    {unselectedGenres.map((opt, index) => (
                                                        <OptionPill
                                                            key={opt.id}
                                                            index={index}
                                                            label={opt.label}
                                                            selected={false}
                                                            onClick={opt.toggle}
                                                        />
                                                    ))}
                                                </ScrollableFilterGroup>
                                            )}
                                            {(genresList.length > 0 || selectedTags.length > 0) && (unselectedTags.length > 0 || selectedTags.length > 0) && tagsList.length > 0 && (
                                                <div style={{
                                                    width: 1,
                                                    height: 16,
                                                    background: 'rgba(255,255,255,0.18)',
                                                    flexShrink: 0,
                                                    margin: '0 4px'
                                                }} />
                                            )}
                                            {/* Etiquetas seleccionadas: siempre visibles fuera del scroll */}
                                            {selectedTags.map((opt) => (
                                                <OptionPill
                                                    key={opt.id}
                                                    index={0}
                                                    label={opt.label}
                                                    selected
                                                    onClick={opt.toggle}
                                                    animateIn={false}
                                                />
                                            ))}
                                            {unselectedTags.length > 0 && (
                                                <ScrollableFilterGroup>
                                                    {unselectedTags.map((opt, index) => (
                                                        <OptionPill
                                                            key={opt.id}
                                                            index={index}
                                                            label={opt.label}
                                                            selected={false}
                                                            onClick={opt.toggle}
                                                        />
                                                    ))}
                                                </ScrollableFilterGroup>
                                            )}
                                        </>
                                    );
                                }

                                return activeOptions.map((opt, index) => (
                                    <OptionPill
                                        key={opt.id}
                                        index={index}
                                        label={opt.label}
                                        selected={opt.selected}
                                        onClick={opt.toggle}
                                    />
                                ));
                            })()}
                        </div>

                        {/* Divisor hacia el botón de añadir/mezclar otras categorías */}
                        <div style={{
                            width: 1,
                            height: 16,
                            background: 'rgba(255,255,255,0.18)',
                            flexShrink: 0,
                            margin: '0 4px'
                        }} />

                        {/* Botón de añadir otra categoría (+) */}
                        <AddFilterButton
                            onClick={() => setIsPickingCategory((prev) => !prev)}
                            isOpen={isPickingCategory}
                            title={globalize.translate('AddOrChangeFilterCategory')}
                        />

                        {/* Selector desplegado de categorías disponibles para anidar */}
                        {isPickingCategory && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                flexShrink: 0,
                                animation: 'jfpSubPillIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) both'
                            }}>
                                {categories
                                    .filter((cat) => cat.id !== categoryMode)
                                    .map((cat) => (
                                        <MainPill
                                            key={cat.id}
                                            label={cat.label}
                                            count={cat.count}
                                            isOpen={false}
                                            onClick={() => {
                                                searchVM.openCategory(cat.id);
                                                setIsPickingCategory(false);
                                            }}
                                        />
                                    ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <SavedViewsRow />
        </div>
    );
}

/**
 * Contenedor desplazable con scroll-snap magnético.
 * Usa un ancho fijo generoso (~3 píldoras) y deja que la siguiente asome
 * ligeramente para indicar que hay más. Al soltar el dedo/ratón, el snap
 * encaja automáticamente en el borde de cada píldora.
 */
function ScrollableFilterGroup({ children }: { children: React.ReactNode }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 1);
        setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1);
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        checkScroll();
        el.addEventListener('scroll', checkScroll, { passive: true });
        return () => el.removeEventListener('scroll', checkScroll);
    }, [children]);

    const scrollBy = (offset: number) => {
        scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' });
    };

    const arrowStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        padding: '0 4px',
        fontSize: 18,
        display: 'flex',
        alignItems: 'center',
        transition: 'opacity 0.2s, color 0.2s',
        lineHeight: 1
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
                onClick={() => scrollBy(-200)}
                aria-label="Deslizar a la izquierda"
                style={{
                    ...arrowStyle,
                    opacity: canScrollLeft ? 1 : 0,
                    pointerEvents: canScrollLeft ? 'auto' : 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >
                ‹
            </button>
            <div
                ref={scrollRef}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    WebkitOverflowScrolling: 'touch',
                    maxWidth: 'min(480px, 50vw)',
                    scrollSnapType: 'x mandatory',
                }}
            >
                {React.Children.map(children, (child) => (
                    <div style={{ scrollSnapAlign: 'start', display: 'inline-flex', flexShrink: 0 }}>
                        {child}
                    </div>
                ))}
            </div>
            <button
                onClick={() => scrollBy(200)}
                aria-label="Deslizar a la derecha"
                style={{
                    ...arrowStyle,
                    opacity: canScrollRight ? 1 : 0,
                    pointerEvents: canScrollRight ? 'auto' : 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >
                ›
            </button>
        </div>
    );
}

/**
 * Vistas guardadas: un chip por vista más «guardar actual». La fila aparece
 * en cuanto hay una vista o hay filtros que valga la pena guardar, para no
 * ocupar sitio en la pantalla de búsqueda recién abierta.
 */
function SavedViewsRow() {
    useVmSignals(searchVM, (vm) => [vm.anyFilterActive]);
    const [views, setViews] = useState<SavedView[]>(() => VIEWS.all());
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const toast = useToast();
    const anyFilterActive = searchVM.anyFilterActive.value;
    const r = useResponsive();

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: r.touch ? 12 : 16 }}>
            {!r.mobile && (
                <span style={{
                    fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
                    color: T.dim, minWidth: 60
                }}>
                    {globalize.translate('HeaderMyViews')}
                </span>
            )}
            <div style={{
                display: 'flex', gap: 8, alignItems: 'center',
                flexWrap: r.touch ? 'nowrap' : 'wrap',
                overflowX: r.touch ? 'auto' : undefined,
                scrollbarWidth: 'none'
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
                            onMouseDown={(e) => e.preventDefault()}
                            style={{
                                padding: '6px 8px 6px 14px', border: 'none', background: 'none',
                                color: T.dim, fontFamily: T.ui, fontSize: 12, cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {v.name}
                        </button>
                        <button
                            onClick={() => VIEWS.remove(v.id)}
                            onMouseDown={(e) => e.preventDefault()}
                            aria-label={`${globalize.translate('Delete')} ${v.name}`}
                            style={{
                                padding: '0 10px 0 2px', border: 'none', background: 'none',
                                color: T.dim, fontSize: 13, lineHeight: 1, cursor: 'pointer'
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
                                if (e.key === 'Escape') {
                                    e.stopPropagation();
                                    setNaming(false);
                                }
                            }}
                            placeholder={globalize.translate('LabelViewName')}
                            style={{
                                background: 'rgba(255,255,255,0.06)', color: 'inherit',
                                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999,
                                padding: '5px 12px', fontFamily: T.ui, fontSize: 12, outline: 'none'
                            }}
                        />
                        <button
                            onClick={save}
                            style={{
                                padding: '5px 12px', borderRadius: 999, border: 'none',
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
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                            padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                            fontFamily: T.ui, fontSize: 12, fontWeight: 500,
                            background: 'none', color: T.dim,
                            border: '1px dashed rgba(255,255,255,0.25)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        + {globalize.translate('SaveCurrentView')}
                    </button>
                )}
            </div>
        </div>
    );
}
