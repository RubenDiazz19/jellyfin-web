import React, { useMemo } from 'react';
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

type Props = {
    items: PlaylistItem[];
    listId?: string;
    navigate: Navigate;
    onReorder?: (items: PlaylistItem[]) => void;
};

export function CollectionCardCarousel({ items, navigate, listId }: Props) {
    const r = useResponsive();
    const isSelecting = useSignalSelector(selectionVM.selecting, (s) => s);

    const cardWidth = r.touch ? 220 : 320;
    const gap = r.touch ? 16 : 24;

    if (!items || items.length === 0) return null;

    return (
        <div
            className='collectionCarouselContainer'
            style={{
                position: 'relative',
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: 0,
                pointerEvents: 'auto',
                display: 'flex',
                gap: gap,
                paddingBottom: 24, // un poco de margen para la sombra
                scrollbarWidth: 'none', // hide scrollbar Firefox
                msOverflowStyle: 'none', // hide scrollbar IE/Edge
            }}
        >
            <style>{`
                .collectionCarouselContainer::-webkit-scrollbar {
                    display: none;
                }
                
                .collectionCardPremium {
                    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    transform: scale(1) translateY(0);
                }
                .collectionCardPremium:hover,
                .collectionCardPremium:focus-visible {
                    transform: scale(1.04);
                    z-index: 10 !important;
                }
                .posterFramePremium {
                    border: 2px solid transparent;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.75);
                    transition: box-shadow 0.3s ease;
                }
                .collectionCardPremium:hover .posterFramePremium,
                .collectionCardPremium:focus-visible .posterFramePremium {
                    box-shadow: 0 12px 32px rgba(0,0,0,0.95);
                }
            `}</style>

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
                    scale={1.8}
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
