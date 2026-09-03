import { useRef, useState, useEffect } from 'react';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { useItemContextMenu } from '../controls/useItemContextMenu';
import type { PlaylistItem } from '../../../domain/api';
import type { Navigate } from '../../../app/router';

type Props = {
    title: string;
    items: PlaylistItem[];
    navigate: Navigate;
};

/**
 * Carrusel horizontal al estilo Disney+ / Star Hub para colecciones:
 * - Fila de pósteres con relación de aspecto vertical (2:3) y esquinas redondeadas.
 * - Título centrado bajo el póster como en las vistas de franquicia de Disney+.
 * - Controles de desplazamiento horizontal suave y navegación táctil / rueda.
 * - Reposa al 100% sobre fondo negro sólido.
 */
export function CollectionCarousel({ title, items, navigate }: Props) {
    const r = useResponsive();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollButtons = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    };

    useEffect(() => {
        updateScrollButtons();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateScrollButtons, { passive: true });
        window.addEventListener('resize', updateScrollButtons);
        return () => {
            el.removeEventListener('scroll', updateScrollButtons);
            window.removeEventListener('resize', updateScrollButtons);
        };
    }, [items]);

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollAmount = el.clientWidth * 0.75;
        el.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    if (!items || items.length === 0) return null;

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            {/* Título de la fila / sección (ej. "LA SERIE DE ANIME" o "PELÍCULAS") */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                    paddingLeft: 4
                }}
            >
                <h2
                    style={{
                        fontFamily: T.ui,
                        fontSize: r.touch ? 13 : 15,
                        fontWeight: 700,
                        letterSpacing: 1.8,
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.9)',
                        margin: 0
                    }}
                >
                    {title}
                </h2>
                <span
                    style={{
                        fontFamily: T.ui,
                        fontSize: 12,
                        color: 'rgba(255, 255, 255, 0.45)',
                        fontWeight: 500
                    }}
                >
                    {items.length}
                </span>
            </div>

            {/* Contenedor del carrusel con flechas de navegación flotantes */}
            <div style={{ position: 'relative', width: '100%' }}>
                {/* Flecha izquierda */}
                {canScrollLeft && !r.touch && (
                    <button
                        type='button'
                        aria-label='Anterior'
                        onClick={() => scroll('left')}
                        style={{
                            position: 'absolute',
                            left: -20,
                            top: '40%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: 'rgba(15, 15, 15, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
                            transition: 'background 0.2s, transform 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(15, 15, 15, 0.85)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.0)';
                        }}
                    >
                        <svg width={20} height={20} viewBox='0 0 24 24' fill='none'>
                            <path d='M15 18l-6-6 6-6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                        </svg>
                    </button>
                )}

                {/* Flecha derecha */}
                {canScrollRight && !r.touch && (
                    <button
                        type='button'
                        aria-label='Siguiente'
                        onClick={() => scroll('right')}
                        style={{
                            position: 'absolute',
                            right: -20,
                            top: '40%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: 'rgba(15, 15, 15, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
                            transition: 'background 0.2s, transform 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(15, 15, 15, 0.85)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.0)';
                        }}
                    >
                        <svg width={20} height={20} viewBox='0 0 24 24' fill='none'>
                            <path d='M9 18l6-6-6-6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                        </svg>
                    </button>
                )}

                {/* Lista deslizable horizontalmente (itemsContainer) */}
                <div
                    ref={scrollRef}
                    className='itemsContainer collectionItemsCarousel'
                    style={{
                        display: 'flex',
                        gap: r.touch ? 12 : 16,
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        paddingBottom: 20,
                        paddingTop: 8,
                        paddingLeft: 4,
                        paddingRight: 4,
                        scrollbarWidth: 'none',
                        scrollBehavior: 'smooth',
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {items.map((item) => (
                        <CarouselPosterCard
                            key={item.id}
                            item={item}
                            navigate={navigate}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function CarouselPosterCard({
    item,
    navigate
}: {
    item: PlaylistItem;
    navigate: Navigate;
}) {
    const r = useResponsive();
    const [hovered, setHovered] = useState(false);

    const isCollection = item.kind === 'collection';
    const isMovie = item.kind === 'movie';

    const ctx = useItemContextMenu({
        id: item.id,
        type: isMovie ? 'movie' : 'show',
        itemTitle: item.title,
        queueSubtitle: item.year ? String(item.year) : undefined,
        queuePoster: item.poster
    });

    const handleClick = () => {
        if (isCollection) {
            navigate({ page: 'list', kind: 'collection', listId: item.id });
        } else if (isMovie) {
            navigate({ page: 'movie', movieId: item.id });
        } else {
            navigate({ page: 'show', showId: item.seriesId ?? item.id });
        }
    };

    const imageSrc = item.poster || item.backdrop || item.heroBackdrop;
    const cardWidth = r.touch ? (r.mobile ? 116 : 136) : 156;

    return (
        <div
            role='button'
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                }
            }}
            onContextMenu={ctx.onContextMenu}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                width: cardWidth,
                flexShrink: 0,
                cursor: 'pointer',
                outline: 'none',
                userSelect: 'none'
            }}
        >
            {/* Contenedor del póster con esquinas redondeadas y micro-interacción al hover */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '2/3',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#151822',
                    boxShadow: hovered ?
                        '0 12px 28px rgba(0, 0, 0, 0.8), 0 0 0 2px rgba(255, 255, 255, 0.75)' :
                        '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                    transform: hovered ? 'scale(1.04)' : 'scale(1.0)',
                    transition: 'transform 0.22s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.22s ease'
                }}
            >
                {imageSrc ? (
                    <img
                        src={imageSrc}
                        alt={item.title}
                        loading='lazy'
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    />
                ) : (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: T.display,
                            fontSize: 32,
                            color: 'rgba(255, 255, 255, 0.2)'
                        }}
                    >
                        {item.title?.[0]}
                    </div>
                )}

                {/* Sutil viñeta inferior sobre el póster */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, transparent 65%, rgba(0, 0, 0, 0.6) 100%)',
                        pointerEvents: 'none'
                    }}
                />

                {/* Logo superpuesto si lo tiene y no hay póster claro */}
                {item.logo && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 8,
                            left: 8,
                            right: 8,
                            display: 'flex',
                            justifyContent: 'center',
                            pointerEvents: 'none'
                        }}
                    >
                        <img
                            src={item.logo}
                            alt=''
                            style={{
                                maxWidth: '85%',
                                maxHeight: 28,
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))'
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Título centrado bajo el póster como en Disney+ Star Hub */}
            <div
                style={{
                    marginTop: 8,
                    textAlign: 'center',
                    padding: '0 2px'
                }}
            >
                <div
                    title={item.title}
                    style={{
                        fontFamily: T.ui,
                        fontSize: r.touch ? 11 : 12,
                        fontWeight: 600,
                        color: hovered ? '#ffffff' : 'rgba(255, 255, 255, 0.9)',
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        transition: 'color 0.15s'
                    }}
                >
                    {item.title}
                </div>
                {item.year && (
                    <div
                        style={{
                            fontFamily: T.ui,
                            fontSize: 10,
                            color: 'rgba(255, 255, 255, 0.45)',
                            marginTop: 2
                        }}
                    >
                        {item.year}
                    </div>
                )}
            </div>

            {ctx.menu}
        </div>
    );
}
