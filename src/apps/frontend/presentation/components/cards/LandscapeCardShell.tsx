import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { CardOverlay } from './CardOverlay';
import { CardProgress } from './CardProgress';

export type LandscapeCardShellProps = {
    cover?: string;
    coverFilter?: string;
    coverTransform?: string;
    onClick: () => void;
    onContextMenu?: (e: MouseEvent) => void;
    width?: number | string;
    flex?: string;
    height?: number;
    aspectRatio?: string;
    selected?: boolean;
    outline?: string;
    outlineOffset?: number;
    gradient?: string;
    topLeft?: ReactNode;
    topRight?: ReactNode;
    centerOverlay?: ReactNode;
    bottomOverlay?: ReactNode;
    progress?: number;
    footer?: ReactNode;
    contextMenu?: ReactNode;
    style?: CSSProperties;
};

/**
 * Shell unificado para tarjetas 16:9 apaisadas (CwCard, EpCard).
 */
export function LandscapeCardShell({
    cover,
    coverFilter,
    coverTransform,
    onClick,
    onContextMenu,
    width,
    flex,
    height,
    aspectRatio = '16/9',
    selected = false,
    outline,
    outlineOffset,
    gradient = 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 55%)',
    topLeft,
    topRight,
    centerOverlay,
    bottomOverlay,
    progress = 0,
    footer,
    contextMenu,
    style
}: LandscapeCardShellProps) {
    const computedOutline = outline ?? (selected ? '3px solid #fff' : undefined);
    const computedOffset = outlineOffset ?? (selected ? -3 : undefined);

    return (
        <div
            onClick={onClick}
            onContextMenu={onContextMenu}
            style={{
                position: 'relative',
                cursor: 'pointer',
                width,
                flex,
                ...style
            }}
            className='jfp-hoverlift'
        >
            <div
                className='jfp-card-m3'
                style={{
                    height,
                    aspectRatio: height ? undefined : aspectRatio,
                    borderRadius: 4,
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#0b0b0b',
                    outline: computedOutline,
                    outlineOffset: computedOffset
                }}
            >
                {cover && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: `url(${cover})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: coverFilter,
                            transform: coverTransform,
                            transition: coverFilter || coverTransform ? 'filter .4s, transform .4s' : undefined
                        }}
                    />
                )}
                <div style={{ position: 'absolute', inset: 0, background: gradient }} />

                <CardOverlay
                    topLeft={topLeft}
                    topRight={topRight}
                />

                {centerOverlay}
                {bottomOverlay}

                {progress > 0 && (
                    <CardProgress value={progress} />
                )}
            </div>
            {footer}
            {contextMenu}
        </div>
    );
}
