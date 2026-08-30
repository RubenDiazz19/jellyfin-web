import { useEffect, useRef, useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { SearchResultCard } from '../cards/SearchResultCard';
import { SelectToggle } from '../controls/SelectToggle';
import { EmptyState } from '../skeleton/Skeleton';
import { searchVM } from '../../../domain/viewModels/SearchViewModel';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import type { Navigate } from '../../../app/router';

const PAGE_SIZE = 48;

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
                <SelectToggle pushRight />
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${r.touch ? (r.mobile ? 110 : 140) : 160}px, 1fr))`,
                gap: r.touch ? `${r.gap + 6}px ${r.gap}px` : '28px 20px'
            }}>
                {visibleItems.map((item) => (
                    <SearchResultCard key={item.id} item={item} navigate={navigate} />
                ))}
            </div>
            {limit < filtered.length && (
                <div ref={sentinelRef} style={{ height: 40, margin: '20px 0' }} />
            )}
        </>
    );
}

