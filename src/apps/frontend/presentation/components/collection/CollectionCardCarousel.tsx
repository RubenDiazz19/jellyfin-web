import React, { useEffect, useRef, useState } from 'react';
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
import { COLLECTION_STYLES } from '../../../domain/stores';
import type { PlaylistItem } from '../../../domain/api';
import type { Navigate } from '../../../app/router';

type Props = {
    items: PlaylistItem[];
    listId?: string;
    navigate: Navigate;
    onReorder?: (items: PlaylistItem[]) => void;
};

/**
 * Carrusel de cards verticales alineado al borde inferior de la colección:
 * - Tamaño +40% respecto al estándar.
 * - Caso A (desborde): Scroll automático continuo lento y fluido en bucle.
 * - Caso B (sin desborde): Cards centradas estáticas sin clones ni desplazamiento.
 * - Mantener pulsado (long-press) / arrastrar: Permite reordenar cualquier carta de posición.
 *   El nuevo orden se guarda de forma persistente en COLLECTION_STYLES.
 */
export function CollectionCardCarousel({ items, listId, navigate, onReorder }: Props) {
    const r = useResponsive();
    const containerRef = useRef<HTMLDivElement>(null);
    const isSelecting = useSignalSelector(selectionVM.selecting, (s) => s);

    // +40% respecto al tamaño anterior:
    // Desktop: 156 * 1.4 = ~220px
    // Touch: 128 * 1.4 = ~180px
    const cardWidth = r.touch ? 180 : 220;
    const gap = r.touch ? 16 : 20;

    // Estado con el orden de las tarjetas (aplicando orden guardado de COLLECTION_STYLES si existe)
    const [orderedItems, setOrderedItems] = useState<PlaylistItem[]>(() => {
        return applySavedOrder(items, listId);
    });

    useEffect(() => {
        setOrderedItems(applySavedOrder(items, listId));
    }, [items, listId]);

    // Estado del arrastre (drag & drop mediante mantener pulsado)
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const isDraggingRef = useRef(false);
    const dragTimeoutRef = useRef<number | null>(null);

    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const checkOverflow = () => {
            const containerW = el.clientWidth || window.innerWidth;
            const totalContentWidth = orderedItems.length * cardWidth + Math.max(0, orderedItems.length - 1) * gap;
            setIsOverflowing(totalContentWidth > containerW);
        };

        checkOverflow();

        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(checkOverflow) : null;
        if (ro) ro.observe(el);
        window.addEventListener('resize', checkOverflow);

        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener('resize', checkOverflow);
        };
    }, [orderedItems.length, cardWidth, gap]);

    // Si no hay items, no pintamos nada
    if (!orderedItems || orderedItems.length === 0) return null;

    // Duplicamos únicamente cuando desborda (Caso A) para permitir el bucle 0% -> -50% sin saltos.
    // En el Caso B (sin desborde), se mantiene el array original sin clones redundantes.
    const displayItems = isOverflowing ? [...orderedItems, ...orderedItems] : orderedItems;

    // Velocidad significativamente más lenta y fluida: ~20 píxeles por segundo
    const totalSingleSetWidth = orderedItems.length * (cardWidth + gap);
    const durationSec = Math.max(45, Math.round(totalSingleSetWidth / 20));

    const maskGradient = isOverflowing && !draggedId ?
        'linear-gradient(to right, transparent 0%, black 56px, black calc(100% - 56px), transparent 100%)' :
        'none';

    // Inicio de pulsación para arrastre (con soporte de mantener pulsado)
    const handleCardPointerDown = (id: string, e: React.PointerEvent) => {
        if (e.button !== 0) return; // Solo botón primario
        const startX = e.clientX;
        const startY = e.clientY;
        isDraggingRef.current = false;

        // Mantener pulsado (long-press): tras 220ms activa el modo arrastrar
        dragTimeoutRef.current = window.setTimeout(() => {
            isDraggingRef.current = true;
            setDraggedId(id);
        }, 220);

        const onPointerMove = (moveEv: PointerEvent) => {
            const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY);
            if (!isDraggingRef.current && dist > 8) {
                if (dragTimeoutRef.current) {
                    window.clearTimeout(dragTimeoutRef.current);
                    dragTimeoutRef.current = null;
                }
                isDraggingRef.current = true;
                setDraggedId(id);
            }

            if (isDraggingRef.current) {
                const el = document.elementFromPoint(moveEv.clientX, moveEv.clientY)?.closest('[data-card-id]') as HTMLElement | null;
                const hoverId = el?.dataset.cardId;
                if (hoverId && hoverId !== id) {
                    setDragOverId(hoverId);
                    setOrderedItems((prev) => swapItems(prev, id, hoverId));
                }
            }
        };

        const onPointerUp = () => {
            if (dragTimeoutRef.current) {
                window.clearTimeout(dragTimeoutRef.current);
                dragTimeoutRef.current = null;
            }
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);

            if (isDraggingRef.current) {
                setDraggedId(null);
                setDragOverId(null);
                setOrderedItems((current) => {
                    persistOrder(current, listId, onReorder);
                    return current;
                });
                // Evitar navegación accidental al soltar
                setTimeout(() => {
                    isDraggingRef.current = false;
                }, 120);
            }
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    };

    return (
        <div
            ref={containerRef}
            className='collectionCarouselContainer'
            style={{
                position: 'relative',
                width: '100%',
                overflow: 'hidden',
                padding: r.touch ? '6px 0 6px 0' : '0 0 28px 0',
                pointerEvents: 'auto',
                maskImage: maskGradient,
                WebkitMaskImage: maskGradient
            }}
        >
            <style>{`
                @keyframes collectionLoopMarquee {
                    0% {
                        transform: translate3d(0, 0, 0);
                    }
                    100% {
                        transform: translate3d(-50%, 0, 0);
                    }
                }
                .collectionMarqueeAnimated {
                    display: flex;
                    gap: ${gap}px;
                    width: max-content;
                    animation: collectionLoopMarquee ${durationSec}s linear infinite;
                    will-change: transform;
                }
                .collectionMarqueeAnimated:hover {
                    animation-play-state: paused;
                }
                .collectionMarqueeStatic {
                    display: flex;
                    gap: ${gap}px;
                    justify-content: center;
                    align-items: flex-end;
                    width: 100%;
                    box-sizing: border-box;
                    padding: 0 24px;
                }
            `}</style>

            <div
                className={isOverflowing ? 'collectionMarqueeAnimated' : 'collectionMarqueeStatic'}
                style={draggedId || isSelecting ? { animationPlayState: 'paused' } : undefined}
            >
                {displayItems.map((item, idx) => (
                    <CollectionVerticalCard
                        key={`${item.id}-${idx}`}
                        item={item}
                        cardWidth={cardWidth}
                        isDragged={draggedId === item.id}
                        isDragOver={dragOverId === item.id}
                        onPointerDown={(e) => handleCardPointerDown(item.id, e)}
                        isDraggingActive={() => isDraggingRef.current}
                        navigate={navigate}
                    />
                ))}
            </div>
        </div>
    );
}

function applySavedOrder(items: PlaylistItem[], listId?: string): PlaylistItem[] {
    if (!listId) return items;
    const saved = COLLECTION_STYLES.getOrder(listId);
    if (!saved || saved.length === 0) return items;

    const map = new Map(items.map((it) => [it.id, it]));
    const sorted: PlaylistItem[] = [];
    for (const id of saved) {
        const it = map.get(id);
        if (it) {
            sorted.push(it);
            map.delete(id);
        }
    }
    for (const it of map.values()) {
        sorted.push(it);
    }
    return sorted;
}

function CollectionVerticalCard({
    item,
    cardWidth,
    isDragged,
    isDragOver,
    onPointerDown,
    isDraggingActive,
    navigate
}: {
    item: PlaylistItem;
    cardWidth: number;
    isDragged: boolean;
    isDragOver: boolean;
    onPointerDown: (e: React.PointerEvent) => void;
    isDraggingActive: () => boolean;
    navigate: Navigate;
}) {
    const selectable: SelectableItem = {
        id: item.id,
        title: item.title,
        kind: item.kind,
        poster: item.poster || item.backdrop || item.seriesPoster,
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
        selectable
    });

    const cover = item.poster || item.backdrop || item.seriesPoster;
    const kindLabel = getKindLabel(item.kind);

    const handleClick = (e: React.MouseEvent) => {
        if (isDraggingActive()) {
            e.stopPropagation();
            return;
        }
        e.stopPropagation();
        sel.onClick();
    };

    let cardTransform = 'scale(1) translateY(0)';
    let cardZIndex = 1;
    let cardTransition = 'transform 0.24s cubic-bezier(0.2, 0, 0, 1), filter 0.24s ease, opacity 0.2s ease';
    let cardBoxShadow = '0 12px 32px rgba(0,0,0,0.75)';
    let cardBorder = '1px solid rgba(255,255,255,0.12)';

    if (isDragged) {
        cardTransform = 'scale(1.08) translateY(-12px)';
        cardZIndex = 50;
        cardTransition = 'transform 0.12s ease, box-shadow 0.12s ease';
        cardBoxShadow = '0 24px 50px rgba(0,0,0,0.95), 0 0 0 2.5px rgba(255,255,255,0.9)';
        cardBorder = '1px solid rgba(255,255,255,0.9)';
    } else if (isDragOver) {
        cardTransform = 'scale(0.96)';
    }

    return (
        <div
            data-card-id={item.id}
            onClick={handleClick}
            onPointerDown={onPointerDown}
            onContextMenu={(e) => {
                e.stopPropagation();
                ctx.onContextMenu(e);
            }}
            style={{
                width: cardWidth,
                flex: `0 0 ${cardWidth}px`,
                cursor: isDragged ? 'grabbing' : 'pointer',
                transform: cardTransform,
                zIndex: cardZIndex,
                transition: cardTransition,
                userSelect: 'none',
                touchAction: 'none'
            }}
            className={isDragged ? '' : 'jfp-hoverlift'}
        >
            <PosterFrame
                borderRadius={8}
                style={{
                    boxShadow: cardBoxShadow,
                    border: sel.selected ? 'none' : cardBorder,
                    outline: sel.selected ? '3px solid #fff' : undefined,
                    outlineOffset: sel.selected ? -3 : undefined
                }}
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
                            fontFamily: T.display,
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
                                fontSize: 10,
                                letterSpacing: 1.5,
                                textTransform: 'uppercase',
                                color: 'rgba(255,255,255,0.7)',
                                background: 'rgba(0,0,0,0.5)',
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

function swapItems(list: PlaylistItem[], fromId: string, toId: string): PlaylistItem[] {
    const fromIdx = list.findIndex((i) => i.id === fromId);
    const toIdx = list.findIndex((i) => i.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return list;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    return next;
}

function persistOrder(
    items: PlaylistItem[],
    listId?: string,
    onReorder?: (items: PlaylistItem[]) => void
): void {
    if (listId) {
        COLLECTION_STYLES.setOrder(listId, items.map((i) => i.id));
    }
    onReorder?.(items);
}
