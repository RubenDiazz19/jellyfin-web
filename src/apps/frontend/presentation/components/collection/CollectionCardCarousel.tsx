import React, { useEffect, useMemo, useRef, useState } from 'react';
import globalize from 'lib/globalize';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { CardOverlay } from '../cards/CardOverlay';
import { PosterFrame } from '../cards/PosterFrame';
import { PosterOverlay } from '../cards/PosterOverlay';
import { SelectionMark } from '../cards/SelectionMark';
import { useItemContextMenu } from '../controls/useItemContextMenu';
import { useSelectionMode } from '../controls/useSelectionMode';
import { selectionVM, type SelectableItem } from '../../../domain/viewModels/SelectionViewModel';
import { useSignalSelector } from '../../../domain/bridge/useViewModel';
import type { PlaylistItem } from '../../../domain/api';
import type { Navigate } from '../../../app/router';
import '../../styles/carousels.css';
type Props = {
    items: PlaylistItem[];
    listId?: string;
    navigate: Navigate;
    onReorder?: (items: PlaylistItem[]) => void;
};

export function CollectionCardCarousel({ items, navigate, listId }: Props) {
    const r = useResponsive();
    const isSelecting = useSignalSelector(selectionVM.selecting, (s) => s);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Reducción del ~18% para aligerar la tarjeta apaisada, dar aire al banner/logo y permitir 4-5 tarjetas visibles en pantalla
    const cardWidth = r.touch ? 200 : 316;
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
            className='collectionCarouselWrapper'
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'relative',
                width: '100%'
            }}
        >
            {/* Flecha de navegación izquierda para escritorio */}
            {!r.touch && canScrollLeft && (
                <button
                    type='button'
                    aria-label='Desplazar a la izquierda'
                    onClick={() => scrollByAmount('left')}
                    style={{
                        position: 'absolute',
                        left: -18,
                        top: '50%',
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
                        transition: 'opacity 0.2s ease, background 0.2s ease, transform 0.15s ease',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.7)'
                    }}
                >
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                        <polyline points='15 18 9 12 15 6' />
                    </svg>
                </button>
            )}

            {/* Carrusel deslizable */}
            <div
                ref={scrollContainerRef}
                className='collectionCarouselContainer'
                style={{
                    position: 'relative',
                    width: '100%',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '16px 0 12px 0',
                    pointerEvents: 'auto',
                    display: 'flex',
                    gap: gap,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollBehavior: 'smooth'
                }}
            >
                {items.map((item, idx) => (
                    <CollectionVerticalCard
                        key={`${item.id}-${idx}`}
                        item={item}
                        cardWidth={cardWidth}
                        navigate={navigate}
                        isSelecting={isSelecting}
                        listId={listId}
                    />
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
                        top: '50%',
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
                        transition: 'opacity 0.2s ease, background 0.2s ease, transform 0.15s ease',
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

function CollectionVerticalCard({
    item,
    cardWidth,
    navigate,
    isSelecting,
    listId
}: {
    item: PlaylistItem;
    cardWidth: number;
    navigate: Navigate;
    isSelecting: boolean;
    listId?: string;
}) {
    const selectable: SelectableItem = {
        id: item.id,
        title: item.title,
        kind: item.kind,
        poster: item.backdrop || item.seriesPoster || item.poster,
        year: item.year
    };

    const sel = useSelectionMode(selectable, () => {
        if (item.kind === 'movie') {
            navigate({ page: 'movie', movieId: item.id });
        } else if (item.kind === 'collection') {
            navigate({ page: 'list', kind: 'collection', listId: item.id });
        } else {
            navigate({ page: 'show', showId: item.seriesId ?? item.id });
        }
    });

    const ctx = useItemContextMenu({
        id: item.id,
        type: item.kind === 'movie' ? 'movie' : item.kind === 'collection' ? 'collection' : 'show',
        itemTitle: item.title,
        queueSubtitle: item.year ? String(item.year) : undefined,
        queuePoster: item.poster,
        selectable,
        parentListId: listId
    });

    const cover = item.backdrop || item.seriesPoster || item.poster;
    const kindLabel = getKindLabel(item.kind);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        sel.onClick();
    };

    const cardRootStyle = useMemo<React.CSSProperties>(() => ({
        width: cardWidth,
        aspectRatio: '16/9',
        flex: `0 0 ${cardWidth}px`,
        cursor: 'pointer',
        zIndex: 1,
        userSelect: 'none',
        touchAction: 'pan-x'
    }), [cardWidth]);

    const frameStyle = useMemo<React.CSSProperties>(() => ({
        border: sel.selected ? 'none' : '2px solid transparent',
        outline: sel.selected ? '3px solid #fff' : undefined,
        outlineOffset: sel.selected ? -3 : undefined,
        aspectRatio: '16/9',
        height: '100%'
    }), [sel.selected]);

    return (
        <div
            data-card-id={item.id}
            onClick={handleClick}
            onContextMenu={(e) => {
                e.stopPropagation();
                ctx.onContextMenu(e);
            }}
            style={cardRootStyle}
            className={isSelecting ? '' : 'collectionCardPremium'}
            role='button'
            tabIndex={0}
        >
            <PosterFrame
                borderRadius={8}
                style={frameStyle}
                className={isSelecting ? '' : 'posterFramePremium'}
            >
                {cover ? (
                    <img
                        src={cover}
                        alt=''
                        loading='lazy'
                        decoding='async'
                        draggable={false}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center',
                            display: 'block',
                            pointerEvents: 'none'
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
                            fontFamily: T.ui,
                            fontSize: 32,
                            color: 'rgba(255,255,255,0.15)'
                        }}
                    >
                        {item.title?.[0]}
                    </div>
                )}

                {/* Sombra de degradado idéntica a las tarjetas del buscador (PosterTile) */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))',
                        pointerEvents: 'none'
                    }}
                />

                {/* Etiqueta superior ("SERIES", "PELÍCULA") o SelectionMark en modo selección */}
                <CardOverlay
                    top={8}
                    left={10}
                    topLeft={sel.selecting ? (
                        <SelectionMark selected={sel.selected} />
                    ) : (
                        <span
                            style={{
                                fontSize: 9,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                                color: 'rgba(255,255,255,0.95)',
                                background: 'rgba(0, 0, 0, 0.4)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                padding: '3px 7px',
                                borderRadius: 4,
                                fontWeight: 600
                            }}
                        >
                            {kindLabel}
                        </span>
                    )}
                />

                {/* Logo oficial o título superpuesto abajo idéntico al buscador */}
                <PosterOverlay
                    logo={item.logo}
                    title={item.title}
                    fontSize='clamp(11px, 7.5cqi, 15px)'
                    fontWeight={600}
                    largeLogo
                />
            </PosterFrame>
            {ctx.menu}
        </div>
    );
}

function getKindLabel(kind: PlaylistItem['kind']): string {
    if (kind === 'movie') return globalize.translate('Movie');
    if (kind === 'episode') return globalize.translate('Episode');
    if (kind === 'collection') return globalize.translate('Collections');
    return globalize.translate('Series');
}
