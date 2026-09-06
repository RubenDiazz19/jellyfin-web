import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { T } from '../../theme/tokens';

type Props = {
    logo?: string | null;
    title: string;
    inProgress?: boolean;
    fontSize?: string;
    fontWeight?: CSSProperties['fontWeight'];
    onLogoClick?: (e: MouseEvent) => void;
};

// Overlay inferior para el logo o título en tarjetas de tipo póster.
export function PosterOverlay({
    logo,
    title,
    inProgress = false,
    fontSize = 'clamp(12px, 8.5cqi, 20px)',
    fontWeight,
    onLogoClick
}: Props) {
    const bottom = inProgress ? '8%' : '5%';
    const interactive = !!onLogoClick;

    const handleClick = (e: MouseEvent) => {
        if (!interactive) return;
        e.stopPropagation();
        onLogoClick(e);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onLogoClick(e as unknown as MouseEvent);
        }
    };

    if (logo) {
        return (
            <div
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? title : undefined}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className={interactive ? 'jfp-poster-logo-btn' : undefined}
                style={{
                    position: 'absolute',
                    left: '6%',
                    right: '8%',
                    bottom,
                    height: '11.9%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-start',
                    pointerEvents: interactive ? 'auto' : 'none',
                    zIndex: interactive ? 2 : undefined,
                    filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))',
                    cursor: interactive ? 'pointer' : undefined,
                    outline: 'none'
                }}
            >
                <img
                    src={logo}
                    alt={title}
                    loading='lazy'
                    decoding='async'
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        objectPosition: 'left bottom',
                        pointerEvents: 'none'
                    }}
                />
            </div>
        );
    }

    return (
        <div
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? title : undefined}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={interactive ? 'jfp-poster-logo-btn' : undefined}
            style={{
                position: 'absolute',
                left: '6%',
                right: '6%',
                bottom,
                maxHeight: '24%',
                display: 'flex',
                alignItems: 'flex-end',
                pointerEvents: interactive ? 'auto' : 'none',
                zIndex: interactive ? 2 : undefined,
                filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))',
                cursor: interactive ? 'pointer' : undefined,
                outline: 'none'
            }}
        >
            <div style={{
                fontFamily: T.ui,
                fontSize,
                fontWeight,
                lineHeight: 1.05,
                textShadow: '0 2px 20px rgba(0,0,0,0.5)',
                color: '#fff',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
            }}>
                {title}
            </div>
        </div>
    );
}
