import globalize from 'lib/globalize';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { CollectionCard } from './CollectionCard';
import type { PlaylistItem } from '../../../domain/api';
import type { Navigate } from '../../../app/router';

type Props = {
    items: PlaylistItem[];
    navigate: Navigate;
    listId?: string;
};

export function SubCollectionsCarousel({ items, navigate, listId }: Props) {
    const r = useResponsive();

    // Tamaño base del póster: más grande que las tarjetas estándar para dar "gran protagonismo"
    const cardWidth = r.touch ? 160 : 260;
    const gap = r.touch ? 16 : 24;

    if (!items || items.length === 0) return null;

    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                fontFamily: T.ui,
                fontSize: r.touch ? 13 : 16,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                marginBottom: 14,
                letterSpacing: 0.8,
                textTransform: 'uppercase'
            }}>
                {globalize.translate('Collections')}
            </div>

            <div
                className='subCollectionsCarousel'
                style={{
                    position: 'relative',
                    width: '100%',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '8px 0 24px', // padding top/bottom para dejar espacio al hover scale
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: gap,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }}
            >
                <style>{`
                    .subCollectionsCarousel::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {items.map((item) => (
                    <div key={item.id} style={{ flex: `0 0 ${cardWidth}px`, width: cardWidth }}>
                        <CollectionCard
                            id={item.id}
                            title={item.title}
                            logo={item.logo}
                            backdrop={item.backdrop}
                            image={item.poster}
                            onClick={() => navigate({ page: 'list', kind: 'collection', listId: item.id })}
                            selectable={{
                                id: item.id,
                                title: item.title,
                                kind: 'collection',
                                poster: item.poster || item.backdrop,
                                year: item.year
                            }}
                            parentListId={listId}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
