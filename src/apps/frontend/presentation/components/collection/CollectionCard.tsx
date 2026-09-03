import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { COLLECTION_STYLES } from '../../../domain/stores';
import { ListCardMenu, type ListMenuHandle } from '../controls/ListCardMenu';
import { useSelectionMode } from '../controls/useSelectionMode';
import { SelectionMark } from '../cards/SelectionMark';
import type { SelectableItem } from '../../../domain/viewModels/SelectionViewModel';

type Props = {
    id: string;
    title: string;
    logo?: string | null;
    backdrop?: string;
    image?: string;
    onClick: () => void;
    onChanged?: () => void;
    onDeleted?: () => void;
    style?: CSSProperties;
    selectable?: SelectableItem;
};

export function CollectionCard({
    id,
    title,
    logo,
    backdrop,
    image,
    onClick,
    onChanged,
    onDeleted,
    style,
    selectable
}: Props) {
    const [hovered, setHovered] = useState(false);
    const [, setTick] = useState(0);
    const menuRef = useRef<ListMenuHandle>(null);

    const selItem: SelectableItem = selectable ?? {
        id,
        title,
        kind: 'collection',
        poster: image ?? backdrop
    };
    const sel = useSelectionMode(selItem, onClick);

    const customColor = COLLECTION_STYLES.getColor(id);
    const bgImage = backdrop ?? image;

    useEffect(() => {
        const onStyleChange = () => setTick((n) => n + 1);
        window.addEventListener(COLLECTION_STYLES.event, onStyleChange);
        return () => window.removeEventListener(COLLECTION_STYLES.event, onStyleChange);
    }, []);

    return (
        <div
            role='button'
            tabIndex={0}
            onClick={sel.onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sel.onClick();
                }
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                menuRef.current?.openAt(e.clientX, e.clientY);
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                outline: sel.selected ? '3px solid #fff' : 'none',
                outlineOffset: sel.selected ? -3 : undefined,
                backgroundColor: customColor ?? (bgImage ? '#0f0f0f' : '#181818'),
                boxShadow: hovered ? '0 12px 28px rgba(0,0,0,0.6)' : '0 4px 12px rgba(0,0,0,0.3)',
                transform: hovered ? 'scale(1.025) translateY(-2px)' : 'scale(1) translateY(0)',
                transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease',
                ...style
            }}
        >
            {/* Indicador de selección cuando el modo selección está activo */}
            {sel.selecting && (
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, pointerEvents: 'none' }}>
                    <SelectionMark selected={sel.selected} />
                </div>
            )}
            {/* Capa de fondo con foto (si no hay color sólido personalizado) */}
            {!customColor && bgImage && (
                <>
                    <img
                        src={bgImage}
                        alt=''
                        aria-hidden='true'
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: hovered ? 'scale(1.05)' : 'scale(1)',
                            transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)'
                        }}
                    />
                    {/* Gradiente oscuro para asegurar contraste con el logo o título */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)'
                    }} />
                </>
            )}

            {/* Sutil viñeta o degradado cuando hay color personalizado para dar profundidad */}
            {customColor && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.25) 100%)',
                    pointerEvents: 'none'
                }} />
            )}

            {/* Degradado si no hay ni color ni foto */}
            {!customColor && !bgImage && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)'
                }} />
            )}

            {/* Primer plano: Logo o título en la esquina inferior izquierda */}
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'flex-start',
                padding: '12px 14px',
                pointerEvents: 'none'
            }}>
                {logo ? (
                    <img
                        src={logo}
                        alt={title}
                        style={{
                            maxWidth: '75%',
                            maxHeight: '45%',
                            objectFit: 'contain',
                            objectPosition: 'left bottom',
                            filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))',
                            transform: hovered ? 'scale(1.04)' : 'scale(1)',
                            transformOrigin: 'bottom left',
                            transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                            pointerEvents: 'none'
                        }}
                    />
                ) : (
                    <span style={{
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: 700,
                        textAlign: 'left',
                        textTransform: 'uppercase',
                        letterSpacing: 1.2,
                        textShadow: '0 2px 10px rgba(0,0,0,0.9)',
                        pointerEvents: 'none',
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {title}
                    </span>
                )}
            </div>

            {/* Menú de opciones (3 puntos) en la esquina superior derecha */}
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    opacity: hovered ? 1 : 0.6,
                    transition: 'opacity 0.2s',
                    zIndex: 2
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <ListCardMenu
                    kind='collection'
                    listId={id}
                    title={title}
                    logo={logo}
                    handle={menuRef}
                    onChanged={onChanged ?? (() => {})}
                    onDeleted={onDeleted}
                    selectable={selItem}
                />
            </div>
        </div>
    );
}
