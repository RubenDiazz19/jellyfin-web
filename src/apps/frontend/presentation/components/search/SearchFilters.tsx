// Filas de filtro de la búsqueda:
// 1. En reposo se muestran las 3 píldoras principales: Tipo, Estado y Géneros.
// 2. Al seleccionar una categoría, las otras dos desaparecen y sus subcategorías
//    se despliegan en la misma línea a la derecha con scroll horizontal.
// 3. La caja de búsqueda principal pasa a filtrar las subcategorías activas.
//
// Vive aparte de SearchPage porque lo usan dos sitios —la página /search y la
// superposición que abre la lupa— y son exactamente los mismos filtros sobre
// el mismo ViewModel.

import { Fragment, useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { useToast } from '../toast/ToastProvider';
import { searchVM, type RatingFilter, type RatingOperator } from '../../../domain/viewModels/SearchViewModel';
import { VIEWS, type SavedView } from '../../../domain/stores';

const TYPE_OPTIONS = [
    { id: 'series', key: 'Shows' },
    { id: 'peliculas', key: 'Movies' }
];

const STATE_OPTIONS = [
    { id: 'favs', key: 'Favorites' },
    { id: 'vistos', key: 'Watched' },
    { id: 'no-vistos', key: 'Unwatched' }
];

export function SearchFilters() {
    const r = useResponsive();
    const categoryMode = searchVM.categoryMode.value;
    const categoryQuery = searchVM.categoryQuery.value.trim().toLowerCase();

    const typeCount = searchVM.typeFilters.value.length;
    const stateCount = searchVM.stateFilters.value.length;
    const tagCount = searchVM.tagFilters.value.length;
    const ratingFilters = searchVM.ratingFilters.value;
    const ratingCount = ratingFilters.length;
    const allTags = searchVM.allTags.value;

    const filteredTypeOptions = TYPE_OPTIONS.filter((opt) =>
        !categoryQuery || globalize.translate(opt.key).toLowerCase().includes(categoryQuery)
    );

    const filteredStateOptions = STATE_OPTIONS.filter((opt) =>
        !categoryQuery || globalize.translate(opt.key).toLowerCase().includes(categoryQuery)
    );

    const filteredTags = allTags.filter((tag) =>
        !categoryQuery || tag.toLowerCase().includes(categoryQuery)
    );

    return (
        <div style={{ marginTop: r.touch ? 14 : 20 }}>
            {/* Animaciones CSS para transiciones limpias, suaves y escalonadas */}
            <style>{`
                @keyframes jfpPillsFadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.96);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes jfpSubPillIn {
                    from {
                        opacity: 0;
                        transform: translateX(12px) scale(0.94);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }
                @keyframes jfpParentPillIn {
                    from {
                        opacity: 0;
                        transform: translateX(-6px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `}</style>

            {/* Fila principal en una sola línea */}
            <div style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'nowrap',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 2
            }}>
                {/* Caso A: Ninguna categoría abierta -> Mostrar las 4 píldoras principales */}
                {categoryMode === null && (
                    <div style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        animation: 'jfpPillsFadeIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both'
                    }}>
                        <MainPill
                            label={globalize.translate('LabelType')}
                            count={typeCount}
                            isOpen={false}
                            onClick={() => searchVM.openCategory('tipo')}
                        />
                        <MainPill
                            label={globalize.translate('LabelStatus')}
                            count={stateCount}
                            isOpen={false}
                            onClick={() => searchVM.openCategory('estado')}
                        />
                        <MainPill
                            label={globalize.translate('Genres')}
                            count={tagCount}
                            isOpen={false}
                            onClick={() => searchVM.openCategory('generos')}
                        />
                        <MainPill
                            label={globalize.translate('Rating')}
                            count={ratingCount}
                            isOpen={false}
                            onClick={() => searchVM.openCategory('valoracion')}
                        />
                    </div>
                )}

                {/* Caso B: Una categoría seleccionada -> Mostrarla como única a la izquierda y sus hijos a la derecha */}
                {categoryMode !== null && (
                    <>
                        {/* Píldora padre seleccionada */}
                        {categoryMode === 'tipo' && (
                            <MainPill
                                label={globalize.translate('LabelType')}
                                count={typeCount}
                                isOpen={true}
                                onClick={searchVM.closeCategory}
                            />
                        )}
                        {categoryMode === 'estado' && (
                            <MainPill
                                label={globalize.translate('LabelStatus')}
                                count={stateCount}
                                isOpen={true}
                                onClick={searchVM.closeCategory}
                            />
                        )}
                        {categoryMode === 'generos' && (
                            <MainPill
                                label={globalize.translate('Genres')}
                                count={tagCount}
                                isOpen={true}
                                onClick={searchVM.closeCategory}
                            />
                        )}
                        {categoryMode === 'valoracion' && (
                            <MainPill
                                label={globalize.translate('Rating')}
                                count={ratingCount}
                                isOpen={true}
                                onClick={searchVM.closeCategory}
                            />
                        )}

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
                                flex: 1,
                                overflowX: 'auto',
                                scrollbarWidth: 'none',
                                WebkitOverflowScrolling: 'touch'
                            }}
                        >
                            {categoryMode === 'tipo' && (
                                filteredTypeOptions.length === 0 ? (
                                    <span style={{ fontSize: 12, color: T.dim, whiteSpace: 'nowrap', padding: '6px 12px' }}>
                                        {globalize.translate('MessageNoResultsFound')}
                                    </span>
                                ) : (
                                    filteredTypeOptions.map((opt, index) => {
                                        const selected = searchVM.hasTypeFilter(opt.id);
                                        return (
                                            <OptionPill
                                                key={opt.id}
                                                index={index}
                                                label={globalize.translate(opt.key)}
                                                selected={selected}
                                                onClick={() => searchVM.toggleTypeFilter(opt.id)}
                                            />
                                        );
                                    })
                                )
                            )}

                            {categoryMode === 'estado' && (
                                filteredStateOptions.length === 0 ? (
                                    <span style={{ fontSize: 12, color: T.dim, whiteSpace: 'nowrap', padding: '6px 12px' }}>
                                        {globalize.translate('MessageNoResultsFound')}
                                    </span>
                                ) : (
                                    filteredStateOptions.map((opt, index) => {
                                        const selected = searchVM.hasStateFilter(opt.id);
                                        return (
                                            <OptionPill
                                                key={opt.id}
                                                index={index}
                                                label={globalize.translate(opt.key)}
                                                selected={selected}
                                                onClick={() => searchVM.toggleStateFilter(opt.id)}
                                            />
                                        );
                                    })
                                )
                            )}

                            {categoryMode === 'generos' && (
                                filteredTags.length === 0 ? (
                                    <span style={{ fontSize: 12, color: T.dim, whiteSpace: 'nowrap', padding: '6px 12px' }}>
                                        {globalize.translate('MessageNoResultsFound')}
                                    </span>
                                ) : (
                                    filteredTags.map((tag, index) => {
                                        const selected = searchVM.hasTagFilter(tag);
                                        return (
                                            <OptionPill
                                                key={tag}
                                                index={index}
                                                label={tag}
                                                selected={selected}
                                                onClick={() => searchVM.toggleTagFilter(tag)}
                                            />
                                        );
                                    })
                                )
                            )}

                            {categoryMode === 'valoracion' && (
                                <RatingFilterBar />
                            )}
                        </div>
                    </>
                )}
            </div>

            <SavedViewsRow />
        </div>
    );
}

const RATING_OPERATORS: { id: RatingOperator; symbol: string }[] = [
    { id: '>=', symbol: '≥' },
    { id: '>', symbol: '>' },
    { id: '<=', symbol: '≤' },
    { id: '<', symbol: '<' },
    { id: '=', symbol: '=' }
];

const PRESETS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];

function RatingFilterBar() {
    const filters = searchVM.ratingFilters.value;
    const [isAdding, setIsAdding] = useState(false);
    const totalCount = filters.length + (isAdding ? 1 : 0);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'nowrap'
        }}>
            {filters.length === 0 ? (
                <RatingFilterItem
                    index={0}
                    filter={null}
                    totalFilters={1}
                    onComplete={() => setIsAdding(false)}
                />
            ) : (
                filters.map((f, i) => (
                    <Fragment key={i}>
                        {i > 0 && (
                            <div style={{
                                width: 1,
                                height: 16,
                                background: 'rgba(255,255,255,0.22)',
                                flexShrink: 0,
                                margin: '0 2px'
                            }} />
                        )}
                        <RatingFilterItem
                            index={i}
                            filter={f}
                            totalFilters={totalCount}
                        />
                    </Fragment>
                ))
            )}

            {filters.length > 0 && isAdding && (
                <>
                    <div style={{
                        width: 1,
                        height: 16,
                        background: 'rgba(255,255,255,0.22)',
                        flexShrink: 0,
                        margin: '0 2px'
                    }} />
                    <RatingFilterItem
                        index={filters.length}
                        filter={null}
                        totalFilters={totalCount}
                        onComplete={() => setIsAdding(false)}
                    />
                </>
            )}

            {filters.length > 0 && !isAdding && (
                <button
                    onClick={() => setIsAdding(true)}
                    onMouseDown={(e) => e.preventDefault()}
                    title='Añadir otro filtro de valoración'
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px dashed rgba(255,255,255,0.35)',
                        color: '#fff',
                        padding: 0,
                        cursor: 'pointer',
                        transition: 'all .2s ease',
                        flexShrink: 0,
                        animation: 'jfpSubPillIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.borderColor = '#fff';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
                    }}
                >
                    <svg width='10' height='10' viewBox='0 0 10 10' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'>
                        <line x1='5' y1='1.5' x2='5' y2='8.5' />
                        <line x1='1.5' y1='5' x2='8.5' y2='5' />
                    </svg>
                </button>
            )}
        </div>
    );
}

function RatingFilterItem({
    index,
    filter,
    totalFilters,
    onComplete
}: {
    index: number;
    filter: RatingFilter | null;
    totalFilters: number;
    onComplete?: () => void;
}) {
    const [selectedOp, setSelectedOp] = useState<RatingOperator>(filter?.operator ?? '>=');
    const [isOpExpanded, setIsOpExpanded] = useState(filter === null);
    const [isPresetExpanded, setIsPresetExpanded] = useState(filter === null);

    const currentOp = filter?.operator ?? selectedOp;
    const opCollapsed = filter !== null && !isOpExpanded;
    const presetCollapsed = filter !== null && !isPresetExpanded;
    const showInternalDivider = filter === null || totalFilters === 1;

    const handleOpClick = (op: RatingOperator) => {
        if (opCollapsed) {
            setIsOpExpanded(true);
        } else {
            setSelectedOp(op);
            if (filter !== null) {
                searchVM.setRatingFilter(op, filter.value, index);
            }
            setIsOpExpanded(false);
        }
    };

    const handlePresetClick = (val: number) => {
        if (presetCollapsed) {
            setIsPresetExpanded(true);
        } else if (filter !== null && filter.value === val) {
            searchVM.removeRatingFilter(index);
            setIsPresetExpanded(true);
        } else {
            searchVM.setRatingFilter(currentOp, val, index);
            setIsPresetExpanded(false);
            if (onComplete) {
                onComplete();
            }
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: showInternalDivider ? 8 : 4,
            flexWrap: 'nowrap'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {RATING_OPERATORS.map((op) => {
                    const selected = filter !== null ? filter.operator === op.id : selectedOp === op.id;
                    return (
                        <CollapsibleOptionPill
                            key={op.id}
                            label={op.symbol}
                            selected={selected}
                            collapsed={opCollapsed}
                            onClick={() => handleOpClick(op.id)}
                        />
                    );
                })}
            </div>

            {showInternalDivider && (
                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.18)', flexShrink: 0, margin: '0 2px' }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {PRESETS.map((p) => {
                    const selected = filter !== null && filter.value === p;
                    return (
                        <CollapsibleOptionPill
                            key={p}
                            label={`★ ${p}`}
                            selected={selected}
                            collapsed={presetCollapsed}
                            onClick={() => handlePresetClick(p)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Píldora que se pliega/colapsa con animación suave y orgánica dentro de la opción seleccionada.
 */
function CollapsibleOptionPill({
    label,
    selected,
    collapsed,
    onClick
}: {
    label: string;
    selected: boolean;
    collapsed: boolean;
    onClick: () => void;
}) {
    const isHidden = collapsed && !selected;

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                overflow: 'hidden',
                maxWidth: isHidden ? 0 : 120,
                opacity: isHidden ? 0 : 1,
                transform: isHidden ? 'scale(0.5)' : 'scale(1)',
                transition: 'max-width 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: isHidden ? 'none' : undefined,
                flexShrink: 0
            }}
        >
            <OptionPill
                label={label}
                selected={selected}
                onClick={onClick}
                animateIn={false}
            />
        </div>
    );
}

/**
 * Píldora principal de categoría (Tipo, Estado, Géneros).
 * Si hay opciones seleccionadas se marca en blanco y muestra (X).
 * Si no hay opciones seleccionadas es transparente y no lleva (X).
 * Al estar abierta, pulsarla cierra el submenú y regresa a las 3 opciones principales.
 */
function MainPill({
    label,
    count,
    isOpen,
    onClick
}: {
    label: string;
    count: number;
    isOpen: boolean;
    onClick: () => void;
}) {
    const isSelected = count > 0;
    const displayText = isSelected ? `${label} (${count})` : label;

    return (
        <button
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            aria-expanded={isOpen}
            style={{
                padding: '7px 16px',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: T.ui,
                fontSize: 13,
                fontWeight: isSelected ? 600 : 500,
                transition: 'all .18s ease',
                whiteSpace: 'nowrap',
                background: isSelected ? '#fff' : isOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                color: isSelected ? '#000' : isOpen ? '#fff' : T.dim,
                border: isSelected ? '1px solid #fff' : isOpen ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                boxShadow: isSelected ? '0 2px 10px rgba(255,255,255,0.18)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                flexShrink: 0
            }}
        >
            <span>{displayText}</span>
        </button>
    );
}

/**
 * Pequeña píldora de opción para la fila horizontal.
 * Si está seleccionada se marca en blanco.
 * Aparece con animación escalonada progresiva según su índice.
 */
function OptionPill({
    label,
    selected,
    onClick,
    index = 0,
    animateIn = true
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
    index?: number;
    animateIn?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
            style={{
                padding: '5px 14px',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: T.ui,
                fontSize: 12,
                fontWeight: selected ? 600 : 400,
                transition: 'background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease',
                whiteSpace: 'nowrap',
                background: selected ? '#fff' : 'rgba(255,255,255,0.06)',
                color: selected ? '#000' : 'rgba(255,255,255,0.75)',
                border: selected ? '1px solid #fff' : '1px solid rgba(255,255,255,0.14)',
                boxShadow: selected ? '0 2px 8px rgba(255,255,255,0.18)' : 'none',
                flexShrink: 0,
                animation: animateIn ? 'jfpSubPillIn 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both' : undefined,
                animationDelay: animateIn ? `${Math.min(index * 25, 200)}ms` : undefined
            }}
        >
            {label}
        </button>
    );
}

/**
 * Vistas guardadas: un chip por vista más «guardar actual». La fila aparece
 * en cuanto hay una vista o hay filtros que valga la pena guardar, para no
 * ocupar sitio en la pantalla de búsqueda recién abierta.
 */
function SavedViewsRow() {
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
