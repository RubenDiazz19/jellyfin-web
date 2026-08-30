import { useEffect, useRef } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useResponsive } from '../../theme/responsive';
import { searchVM } from '../../../domain/viewModels/SearchViewModel';
import { useVmSignals } from '../../../domain/bridge/useViewModel';

type Props = {
    /** Enfoca al montar. La superposición lo quiere; la página, también. */
    autoFocus?: boolean;
    /** Ancho máximo. La superposición la quiere más ancha que la página. */
    maxWidth?: number;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function SearchInput({ autoFocus, maxWidth, onKeyDown }: Props) {
    useVmSignals(searchVM, (vm) => [vm.categoryMode, vm.categoryQuery, vm.query]);
    const r = useResponsive();
    const inputRef = useRef<HTMLInputElement>(null);
    const categoryMode = searchVM.categoryMode.value;
    const categoryQuery = searchVM.categoryQuery.value;
    const globalQuery = searchVM.query.value;

    const isCategoryMode = categoryMode !== null;
    const currentValue = isCategoryMode ? categoryQuery : globalQuery;

    useEffect(() => {
        if (!autoFocus) return;
        // Con retardo: si se enfoca en el mismo frame en que arranca la
        // animación de entrada, Safari y Chrome se saltan la transición.
        const t = setTimeout(() => inputRef.current?.focus(), 80);
        return () => clearTimeout(t);
    }, [autoFocus]);

    // Al abrir una categoría se re-enfoca la caja de búsqueda para filtrar al vuelo
    useEffect(() => {
        if (isCategoryMode) {
            inputRef.current?.focus();
        }
    }, [isCategoryMode]);

    const getPlaceholder = () => {
        if (!categoryMode) return globalize.translate('SearchPlaceholder');
        if (categoryMode === 'tipo') return `${globalize.translate('Search')} ${globalize.translate('LabelType').toLowerCase()}...`;
        if (categoryMode === 'estado') return `${globalize.translate('Search')} ${globalize.translate('LabelStatus').toLowerCase()}...`;
        if (categoryMode === 'generos') return `${globalize.translate('Search')} ${globalize.translate('Genres').toLowerCase()}...`;
        if (categoryMode === 'valoracion') return `${globalize.translate('Search')} ${globalize.translate('Rating').toLowerCase()} (ej. 7.5)...`;
        return globalize.translate('SearchPlaceholder');
    };

    const handleClear = () => {
        if (isCategoryMode) {
            searchVM.setCategoryQuery('');
        } else {
            searchVM.clearQuery();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape' && isCategoryMode) {
            e.stopPropagation();
            searchVM.closeCategory();
            return;
        }
        onKeyDown?.(e);
    };

    return (
        <div style={{ position: 'relative', maxWidth: r.touch ? undefined : maxWidth }}>
            <div style={{
                position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                color: isCategoryMode ? '#fff' : T.dim, pointerEvents: 'none',
                transition: 'color .2s'
            }}>
                <Ic.Search size={r.touch ? 18 : 20} />
            </div>
            <input
                ref={inputRef}
                value={currentValue}
                onChange={(e) => {
                    if (isCategoryMode) {
                        searchVM.setCategoryQuery(e.target.value);
                    } else {
                        searchVM.setQuery(e.target.value);
                    }
                }}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholder()}
                style={{
                    width: '100%', boxSizing: 'border-box',
                    background: r.touch ?
                        'var(--md-sys-color-surface-container-high, rgba(255,255,255,0.06))' :
                        'rgba(255,255,255,0.06)',
                    border: r.touch ? 'none' : isCategoryMode ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: r.touch ? 'var(--md-sys-shape-corner-full, 28px)' : 12,
                    padding: r.touch ? '15px 18px 15px 50px' : '18px 20px 18px 52px',
                    color: 'inherit', fontFamily: T.ui,
                    fontSize: r.touch ? 16 : 18, outline: 'none',
                    transition: 'border-color .2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.35)')}
                onBlur={(e) => (e.target.style.borderColor = isCategoryMode ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)')}
            />
            {currentValue && (
                <button
                    type='button'
                    onClick={handleClear}
                    aria-label={globalize.translate('Clear')}
                    style={{
                        position: 'absolute', right: 10, top: '50%',
                        transform: 'translateY(-50%)', cursor: 'pointer',
                        color: T.dim, fontSize: 20, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, padding: 0,
                        background: 'none', border: 'none', borderRadius: '50%',
                        fontFamily: T.ui
                    }}
                >
                    <span aria-hidden='true'>✕</span>
                </button>
            )}
        </div>
    );
}
