// Resultados de la búsqueda: cabecera con el recuento, botón de selección y
// rejilla. Compartido por la página /search y la superposición.

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { SearchResultCard } from '../cards/SearchResultCard';
import { SelectToggle } from '../controls/SelectToggle';
import { EmptyState } from '../skeleton/Skeleton';
import { searchVM } from '../../../domain/viewModels/SearchViewModel';
import type { Navigate } from '../../../app/router';

export function SearchResults({ navigate }: { navigate: Navigate }) {
    const r = useResponsive();
    const q = searchVM.query.value.trim();
    const filtered = searchVM.results.value;
    const anyFilterActive = searchVM.anyFilterActive.value;

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
                {filtered.map((item) => (
                    <SearchResultCard key={item.id} item={item} navigate={navigate} />
                ))}
            </div>
        </>
    );
}

