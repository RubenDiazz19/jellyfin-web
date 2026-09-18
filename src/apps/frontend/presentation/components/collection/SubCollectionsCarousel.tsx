import { useEffect, useRef, useState } from 'react';
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Tamaño base del póster: más grande que las tarjetas estándar para dar "gran protagonismo"
    const cardWidth = r.touch ? 160 : 260;
    const gap = r.touch ? 16 : 24;

    const checkScrollButtons = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    };

    useEffect(() => {
        checkScrollButtons();
        const el = scrollContainerRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScrollButtons, { passive: true });
        window.addEventListener('resize', checkScrollButtons);
        return () => {
            el.removeEventListener('scroll', checkScrollButtons);
            window.removeEventListener('resize', checkScrollButtons);
        };
    }, [items]);

    const scrollByAmount = (direction: 'left' | 'right') => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const amount = (el.clientWidth * 0.75) * (direction === 'left' ? -1 : 1);
        el.scrollBy({ left: amount, behavior: 'smooth' });
    };

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

            {/* Flecha de navegación izquierda para escritorio */}
            {!r.touch && canScrollLeft && (
                <button
                    type='button'
                    aria-label='Desplazar a la izquierda'
                    onClick={() => scrollByAmount('left')}
                    style={{
                        position: 'absolute',
                        left: -18,
                        top: '55%',
                        transform: 'translateY(-50%)',
                        width: 44,
                        height: 72,
                        borderRadius: '0 8px 8px 0',
                        background: 'rgba(9, 11, 16, 0.75)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderLeft: 'none',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 12,
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.2s ease, background 0.2s ease',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.7)'
                    }}
                >
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                        <polyline points='15 18 9 12 15 6' />
                    </svg>
                </button>
            )}

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

            {/* Flecha de navegación derecha para escritorio */}
            {!r.touch && canScrollRight && (
                <button
                    type='button'
                    aria-label='Desplazar a la derecha'
                    onClick={() => scrollByAmount('right')}
                    style={{
                        position: 'absolute',
                        right: -18,
                        top: '55%',
                        transform: 'translateY(-50%)',
                        width: 44,
                        height: 72,
                        borderRadius: '8px 0 0 8px',
                        background: 'rgba(9, 11, 16, 0.75)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRight: 'none',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 12,
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.2s ease, background 0.2s ease',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.7)'
                    }}
                >
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                        <polyline points='9 18 15 12 9 6' />
                    </svg>
                </button>
            )}
        </div>
    );
}
