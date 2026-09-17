import { useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { SearchResultCard } from '../cards/SearchResultCard';
import { SortControl } from '../controls/SortControl';
import { EmptyState } from '../skeleton/Skeleton';
import { searchVM } from '../../../domain/viewModels/SearchViewModel';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import type { Navigate } from '../../../app/router';
import type { CatalogItem } from '../../../domain/models';

import type { SearchSortKey } from '../../../domain/viewModels/SearchViewModel';

const PAGE_SIZE = 48;

const SEARCH_SORT_LABELS: { id: SearchSortKey; key: string }[] = [
    { id: 'relevance', key: 'Relevancia' },
    { id: 'title', key: 'Name' },
    { id: 'year', key: 'LabelYear' },
    { id: 'rating', key: 'CommunityRating' },
    { id: 'runtime', key: 'Runtime' },
    { id: 'random', key: 'OptionRandom' }
];

export function SearchResults({ navigate }: { navigate: Navigate }) {
    useVmSignals(searchVM, (vm) => [vm.query, vm.results, vm.searching, vm.anyFilterActive]);
    const r = useResponsive();
    const q = searchVM.query.value.trim();
    const filtered = searchVM.results.value;
    const anyFilterActive = searchVM.anyFilterActive.value;

    const [limit, setLimit] = useState(PAGE_SIZE);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Reinicia el límite al cambiar la consulta o los filtros para respuesta instantánea
    useEffect(() => {
        setLimit(PAGE_SIZE);
    }, [q, anyFilterActive]);

    // Carga progresiva al hacer scroll hacia el final de la lista
    useEffect(() => {
        if (limit >= filtered.length) return;
        const el = sentinelRef.current;
        if (!el) return;

        const obs = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting) {
                setLimit((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
            }
        }, { rootMargin: '400px' });

        obs.observe(el);
        return () => obs.disconnect();
    }, [limit, filtered.length]);

    if (filtered.length === 0) {
        if (q) {
            // El servidor todavía puede traer algo que aquí no estaba cargado:
            // decir «sin resultados» ahora es desmentirse medio segundo después.
            if (searchVM.searching.value) {
                return <EmptyState title={globalize.translate('SearchLookingOnServer')} icon='⌕' />;
            }
            return (
                <EmptyState
                    title={globalize.translate('SearchNoResultsFor', q)}
                    hint={globalize.translate('SearchNoResultsForHelp')}
                    icon='⌕'
                />
            );
        }
        if (anyFilterActive) {
            return (
                <EmptyState
                    title={globalize.translate('SearchNoResultsFilters')}
                    hint={globalize.translate('SearchNoResultsFiltersHelp')}
                    icon='⌕'
                />
            );
        }
        return (
            <EmptyState
                title={globalize.translate('SearchStartTyping')}
                hint={globalize.translate('SearchStartTypingHelp')}
                icon='⌕'
            />
        );
    }

    const visibleItems = filtered.slice(0, limit);
    const moviesAndSeries = visibleItems.filter((item) => item.kind !== 'collection');
    const collections = visibleItems.filter((item) => item.kind === 'collection');

    const toCardItem = (item: typeof filtered[number]): CatalogItem => ({
        ...item,
        title: 'title' in item ? item.title : item.name,
        year: 'year' in item ? item.year : 0
    });

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <div style={{
                    fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim
                }}>
                    {q || anyFilterActive ?
                        globalize.translate('SearchResultsCount', filtered.length) :
                        globalize.translate('HeaderMyLibrary')}
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <SortControl
                        value={searchVM.sortKey.value}
                        onChange={searchVM.setSort}
                        options={SEARCH_SORT_LABELS}
                    />
                </div>
            </div>
            {moviesAndSeries.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${r.touch ? (r.mobile ? 110 : 140) : 160}px, 1fr))`,
                    gap: r.touch ? `${r.gap + 6}px ${r.gap}px` : '28px 20px',
                    marginBottom: collections.length > 0 ? 40 : 0
                }}>
                    {moviesAndSeries.map((item) => (
                        <SearchResultCard key={item.id} item={toCardItem(item)} navigate={navigate} />
                    ))}
                </div>
            )}

            {collections.length > 0 && (
                <>
                    {moviesAndSeries.length > 0 && (
                        <div style={{
                            height: 1,
                            background: 'rgba(255, 255, 255, 0.08)',
                            marginBottom: 40,
                            width: '100%',
                            maxWidth: 300
                        }} />
                    )}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill, minmax(${r.touch ? (r.mobile ? 200 : 220) : 260}px, 1fr))`,
                        gap: r.touch ? `${r.gap + 6}px ${r.gap}px` : '28px 20px'
                    }}>
                        {collections.map((item) => (
                            <SearchResultCard
                                key={item.id}
                                item={toCardItem(item)}
                                navigate={navigate}
                            />
                        ))}
                    </div>
                </>
            )}
            {limit < filtered.length && (
                <div ref={sentinelRef} style={{ height: 40, margin: '20px 0' }} />
            )}
        </>
    );
}

