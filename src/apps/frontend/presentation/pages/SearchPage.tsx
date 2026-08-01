// Página /search. La ruta se conserva para enlaces directos y para la
// navegación inferior de móvil, donde una página completa se maneja mejor que
// una capa; en escritorio la lupa de la barra abre `SearchOverlay`, que usa
// exactamente estos mismos componentes sobre el mismo ViewModel.

import { useEffect } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { SearchFilters } from '../components/search/SearchFilters';
import { SearchInput } from '../components/search/SearchInput';
import { SearchResults } from '../components/search/SearchResults';
import { SelectionBar } from '../components/controls/SelectionBar';
import { searchVM } from '../../domain/viewModels/SearchViewModel';
import { selectionVM, type SelectableItem } from '../../domain/viewModels/SelectionViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

export function SearchPage({ navigate }: { navigate: Navigate }) {
    // Todo el filtrado vive en SearchViewModel; la página solo pinta signals.
    useViewModel(searchVM);
    const r = useResponsive();

    useEffect(() => {
        // start() re-filtra cuando cambian favoritos/vistos desde otro sitio;
        // load() trae la biblioteca real para buscar sobre ella.
        const stop = searchVM.start();
        void searchVM.load();
        return () => {
            stop();
            // Salir de la búsqueda no debe dejar una selección viva.
            selectionVM.stop();
        };
    }, []);

    const selectable: SelectableItem[] = searchVM.results.value.map((i) => ({
        id: i.id, title: i.title, kind: i._type, poster: i.poster, year: i.year
    }));

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
                <SearchInput autoFocus maxWidth={720} />
                <SearchFilters />
            </div>

            <div style={{ padding: r.touch ? `24px ${r.pagePad}px 56px` : '36px 64px 80px' }}>
                <SearchResults navigate={navigate} />
            </div>

            <SelectionBar items={selectable} />
        </div>
    );
}
