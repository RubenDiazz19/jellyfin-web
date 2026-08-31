// Filas de filtro de la búsqueda:
// 1. En reposo se muestran las 3 píldoras principales: Tipo, Estado y Géneros.
// 2. Al seleccionar una categoría, las otras dos desaparecen y sus subcategorías
//    se despliegan en la misma línea a la derecha con scroll horizontal.
// 3. La caja de búsqueda principal pasa a filtrar las subcategorías activas.
//
// Vive aparte de SearchPage porque lo usan dos sitios —la página /search y la
// superposición que abre la lupa— y son exactamente los mismos filtros sobre
// el mismo ViewModel.

import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { useToast } from '../toast/ToastProvider';
import { searchVM, type StateFilter, type TypeFilter } from '../../../domain/viewModels/SearchViewModel';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import { VIEWS, type SavedView } from '../../../domain/stores';
import { AddFilterButton, MainPill, OptionPill } from './SearchPills';
import { RatingFilterBar } from './RatingFilterBar';

const TYPE_OPTIONS: { id: TypeFilter; key: string }[] = [
    { id: 'series', key: 'Shows' },
    { id: 'peliculas', key: 'Movies' }
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
        vm.allTags,
        vm.anyFilterActive
    ]);
    const r = useResponsive();
    const categoryMode = searchVM.categoryMode.value;
    const categoryQuery = searchVM.categoryQuery.value.trim().toLowerCase();
    const [isPickingCategory, setIsPickingCategory] = useState(false);

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
                            onClick={() => {
                                setIsPickingCategory(false);
                                searchVM.openCategory('tipo');
                            }}
                        />
                        <MainPill
                            label={globalize.translate('LabelStatus')}
                            count={stateCount}
                            isOpen={false}
                            onClick={() => {
                                setIsPickingCategory(false);
                                searchVM.openCategory('estado');
                            }}
                        />
                        <MainPill
                            label={globalize.translate('Genres')}
                            count={tagCount}
                            isOpen={false}
                            onClick={() => {
                                setIsPickingCategory(false);
                                searchVM.openCategory('generos');
                            }}
                        />
                        <MainPill
                            label={globalize.translate('Rating')}
                            count={ratingCount}
                            isOpen={false}
                            onClick={() => {
                                setIsPickingCategory(false);
                                searchVM.openCategory('valoracion');
                            }}
                        />
                    </div>
                )}

                {/* Caso B: Una categoría seleccionada -> Mostrarla a la izquierda con sus hijos, y el botón + para anidar otras categorías */}
                {categoryMode !== null && (
                    <>
                        {/* Píldora padre seleccionada */}
                        {categoryMode === 'tipo' && (
                            <MainPill
                                label={globalize.translate('LabelType')}
                                count={typeCount}
                                isOpen={true}
                                onClick={() => {
                                    setIsPickingCategory(false);
                                    searchVM.closeCategory();
                                }}
                            />
                        )}
                        {categoryMode === 'estado' && (
                            <MainPill
                                label={globalize.translate('LabelStatus')}
                                count={stateCount}
                                isOpen={true}
                                onClick={() => {
                                    setIsPickingCategory(false);
                                    searchVM.closeCategory();
                                }}
                            />
                        )}
                        {categoryMode === 'generos' && (
                            <MainPill
                                label={globalize.translate('Genres')}
                                count={tagCount}
                                isOpen={true}
                                onClick={() => {
                                    setIsPickingCategory(false);
                                    searchVM.closeCategory();
                                }}
                            />
                        )}
                        {categoryMode === 'valoracion' && (
                            <MainPill
                                label={globalize.translate('Rating')}
                                count={ratingCount}
                                isOpen={true}
                                onClick={() => {
                                    setIsPickingCategory(false);
                                    searchVM.closeCategory();
                                }}
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
                                flexShrink: 0
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
                                {categoryMode !== 'tipo' && (
                                    <MainPill
                                        label={globalize.translate('LabelType')}
                                        count={typeCount}
                                        isOpen={false}
                                        onClick={() => {
                                            searchVM.openCategory('tipo');
                                            setIsPickingCategory(false);
                                        }}
                                    />
                                )}
                                {categoryMode !== 'estado' && (
                                    <MainPill
                                        label={globalize.translate('LabelStatus')}
                                        count={stateCount}
                                        isOpen={false}
                                        onClick={() => {
                                            searchVM.openCategory('estado');
                                            setIsPickingCategory(false);
                                        }}
                                    />
                                )}
                                {categoryMode !== 'generos' && (
                                    <MainPill
                                        label={globalize.translate('Genres')}
                                        count={tagCount}
                                        isOpen={false}
                                        onClick={() => {
                                            searchVM.openCategory('generos');
                                            setIsPickingCategory(false);
                                        }}
                                    />
                                )}
                                {categoryMode !== 'valoracion' && (
                                    <MainPill
                                        label={globalize.translate('Rating')}
                                        count={ratingCount}
                                        isOpen={false}
                                        onClick={() => {
                                            searchVM.openCategory('valoracion');
                                            setIsPickingCategory(false);
                                        }}
                                    />
                                )}
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
