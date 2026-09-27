import { useState } from 'react';
import globalize from 'lib/globalize';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { CollectionCard } from './CollectionCard';
import { useCarouselScroll } from './useCarouselScroll';
import { CarouselNavButton } from './CarouselNavButton';
import type { PlaylistItem } from '../../../domain/api';
import type { Navigate } from '../../../app/router';
import '../../styles/carousels.css';

type Props = {
    items: PlaylistItem[];
    navigate: Navigate;
    listId?: string;
};

export function SubCollectionsCarousel({ items, navigate, listId }: Props) {
    const r = useResponsive();
    const { scrollContainerRef, canScrollLeft, canScrollRight, scrollByAmount } = useCarouselScroll([items]);
    const [isHovered, setIsHovered] = useState(false);

    // Tamaño base del póster: más grande que las tarjetas estándar para dar "gran protagonismo"
    const cardWidth = r.touch ? 148 : 240;
    const gap = r.touch ? 16 : 24;

    if (!items || items.length === 0) return null;

    return (
        <div
            className='subCollectionsWrapper'
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ position: 'relative', width: '100%' }}
        >
            <div style={{
                fontFamily: T.ui,
                fontSize: r.touch ? 14 : 18,
                fontWeight: 700,
                color: '#f9f9f9',
                marginBottom: 12,
                letterSpacing: 0.3
            }}>
                {globalize.translate('Collections')}
            </div>

            {!r.touch && <CarouselNavButton direction='left' onClick={() => scrollByAmount('left')} visible={isHovered && canScrollLeft} top='55%' />}

            <div
                ref={scrollContainerRef}
                className='subCollectionsCarousel'
                style={{
                    position: 'relative',
                    width: '100%',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '8px 0 24px',
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: gap,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollBehavior: 'smooth'
                }}
            >

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

            {!r.touch && <CarouselNavButton direction='right' onClick={() => scrollByAmount('right')} visible={isHovered && canScrollRight} top='55%' />}
        </div>
    );
}
