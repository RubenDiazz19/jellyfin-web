// Resultados de la búsqueda: cabecera con el recuento, botón de selección y
// rejilla. Compartido por la página /search y la superposición.

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { SearchResultCard } from '../cards/SearchResultCard';
import { EmptyState } from '../skeleton/Skeleton';
import { searchVM } from '../../../domain/viewModels/SearchViewModel';
import { selectionVM } from '../../../domain/viewModels/SelectionViewModel';
import { useVmSignals } from '../../../domain/bridge/useViewModel';
import type { Navigate } from '../../../app/router';

export function SearchResults({ navigate }: { navigate: Navigate }) {
    const r = useResponsive();
    const q = searchVM.query.value.trim();
    const filtered = searchVM.results.value;
    const anyFilterActive = searchVM.anyFilterActive.value;

    if (filtered.length === 0) {
        if (q) {
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
