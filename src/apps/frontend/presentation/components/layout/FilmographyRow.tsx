import type { ReactNode } from 'react';
import { T } from '../../theme/tokens';

type FilmographyRowProps<TItem> = {
    title: string;
    items: TItem[];
    watchedCount: number;
    renderCard: (item: TItem) => ReactNode;
    marginBottom?: number;
};

/**
 * Fila horizontal de filmografía (Películas o Series) en la ficha de persona.
 * Incluye cabecera con contador de vistas y carrusel deslizable con scroll táctil.
 */
export function FilmographyRow<TItem extends { id: string }>({
    title,
    items,
    watchedCount,
    renderCard,
    marginBottom = 40
}: FilmographyRowProps<TItem>) {
    if (items.length === 0) return null;
    return (
        <div style={{ marginBottom }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
                <h2 style={{ fontFamily: T.ui, fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h2>
                <span style={{ fontSize: 14, color: T.dim, fontFamily: T.ui }}>
                    {watchedCount} / {items.length} vistas
                </span>
            </div>
            <div style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                paddingBottom: 12,
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
            }}>
                {items.map((item) => (
                    <div key={item.id} style={{ width: 140, flexShrink: 0 }}>
                        {renderCard(item)}
                    </div>
                ))}
            </div>
        </div>
    );
}
