// Página /search. La ruta se conserva para enlaces directos y para la
// navegación inferior de móvil, donde una página completa se maneja mejor que
// una capa; en escritorio la lupa de la barra abre `SearchOverlay`, que usa
// exactamente estos mismos componentes sobre el mismo ViewModel.

import { useEffect, useMemo } from 'react';

import globalize from 'lib/globalize';

import { C, T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { SearchFilters } from '../components/search/SearchFilters';
import { SearchInput } from '../components/search/SearchInput';
import { SearchResults } from '../components/search/SearchResults';
import { searchVM } from '../../domain/viewModels/SearchViewModel';
import { selectionVM, type SelectableItem } from '../../domain/viewModels/SelectionViewModel';
import { useSignalValue } from '../../domain/bridge/useViewModel';
import { useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

export function SearchPage({ navigate }: { navigate: Navigate }) {
    const r = useResponsive();
    const rawResults = useSignalValue(searchVM.results);

    useEffect(() => {
        // start() re-filtra cuando cambian favoritos/vistos desde otro sitio;
        // load() trae la biblioteca real para buscar sobre ella.
        const stop = searchVM.start();
        void searchVM.load();
        return () => {
            stop();
            // Salir de la búsqueda no debe dejar una selección viva.
            selectionVM.stop();
            selectionVM.setVisibleItems([]);
        };
    }, []);

    const selectable: SelectableItem[] = useMemo(() => {
        const results = rawResults ?? [];
        return results.map((i) => ({
            id: i.id, title: i.title, kind: i.kind, poster: i.poster, year: i.year
        }));
    }, [rawResults]);

    useEffect(() => {
        selectionVM.setVisibleItems(selectable);
    }, [selectable]);

    return (
        <div style={{
            minHeight: '100vh',
            background: C.bg,
            color: C.fg,
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
                <SearchInput autoFocus maxWidth={720} />
                <SearchFilters />
            </div>

            <div style={{ padding: r.touch ? `24px ${r.pagePad}px 56px` : '36px 64px 80px' }}>
                <SearchResults navigate={navigate} />
            </div>
        </div>
    );
}
