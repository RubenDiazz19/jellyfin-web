// La búsqueda como capa sobre la página actual, que es lo que abre la lupa de
// la barra superior.
//
// Se monta una sola vez en el shell (App.tsx), no por página: así la lupa
// funciona igual esté uno en Inicio, en una ficha o en la biblioteca, y la
// capa queda por encima de cualquier hero a pantalla completa.

import { useEffect } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { SearchFilters } from './SearchFilters';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';
import { SelectionBar } from '../controls/SelectionBar';
import { NAV_BOTTOM_VAR } from '../nav/navMetrics';
import { searchVM } from '../../../domain/viewModels/SearchViewModel';
import { selectionVM, type SelectableItem } from '../../../domain/viewModels/SelectionViewModel';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import type { Navigate } from '../../../app/router';

export function SearchOverlay({ navigate }: { navigate: Navigate }) {
    useViewModel(searchVM);
    const r = useResponsive();
    const open = searchVM.overlayOpen.value;

    useEffect(() => {
        if (!open) return;
        // Re-filtra si cambian favoritos/vistos desde otro sitio mientras la
        // capa está abierta.
        const stop = searchVM.start();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') searchVM.closeOverlay();
        };
        window.addEventListener('keydown', onKey);
        // La página de debajo no debe desplazarse con la capa abierta.
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            stop();
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
            // Salir de la búsqueda no debe dejar una selección viva.
            selectionVM.stop();
        };
    }, [open]);

    if (!open) return null;

    const selectable: SelectableItem[] = searchVM.results.value.map((i) => ({
        id: i.id, title: i.title, kind: i.kind, poster: i.poster, year: i.year
    }));

    /** Navega y cierra: el destino es una página, no cabe bajo la capa. */
    const navigateAndClose: Navigate = (route) => {
        searchVM.closeOverlay();
        navigate(route);
    };

    return (
        <div
            role='dialog'
            aria-modal='true'
            aria-label={globalize.translate('Search')}
            style={{
                position: 'fixed', inset: 0, zIndex: 120,
                display: 'flex', flexDirection: 'column',
                // El desenfoque deja entrever la página de debajo, que es lo
                // que dice «esto está encima» en vez de «has navegado».
                background: 'rgba(8,8,10,0.92)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                animation: 'jfp-fade-in 0.2s ease-out both'
            }}
        >
            <div style={{
                flex: '0 0 auto',
                padding: r.touch ? `20px ${r.pagePad}px 0` : '40px 64px 0',
                animation: 'jfp-search-in 0.32s cubic-bezier(0.05, 0.7, 0.1, 1) both'
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <SearchInput autoFocus maxWidth={860} />
                    </div>
                    <button
                        onClick={searchVM.closeOverlay}
                        aria-label={globalize.translate('ButtonCancel')}
                        style={{
                            flex: '0 0 auto',
                            width: r.touch ? 44 : 52, height: r.touch ? 44 : 56,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 12, cursor: 'pointer',
                            color: T.dim, fontSize: 20, fontFamily: T.ui
                        }}
                    >
                        <span aria-hidden='true'>✕</span>
                    </button>
                </div>
                <SearchFilters />
            </div>

            {/* El scroll vive aquí dentro: la cabecera con la caja y los
                filtros se queda fija mientras se recorren los resultados. */}
            {/* La capa es fixed, así que el hueco de la navegación no se lo da
                el body: el último resultado se quedaría debajo de la píldora. */}
            <div style={{
                flex: 1, minHeight: 0, overflowY: 'auto',
                padding: r.touch ?
                    `24px ${r.pagePad}px calc(var(${NAV_BOTTOM_VAR}, 0px) + 32px)` :
                    '36px 64px 80px',
                animation: 'jfp-fade-in 0.4s ease-out both'
            }}>
                <SearchResults navigate={navigateAndClose} />
            </div>

            <SelectionBar items={selectable} />
        </div>
    );
}
