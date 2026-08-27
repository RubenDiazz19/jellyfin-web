import type { CSSProperties } from 'react';
import { T } from '../../theme/tokens';

type Props = {
    logo?: string | null;
    title: string;
    inProgress?: boolean;
    fontSize?: string;
    fontWeight?: CSSProperties['fontWeight'];
};

// Overlay inferior para el logo o título en tarjetas de tipo póster.
export function PosterOverlay({
    logo,
    title,
    inProgress = false,
    fontSize = 'clamp(12px, 8.5cqi, 20px)',
    fontWeight
}: Props) {
    const bottom = inProgress ? '8%' : '5%';

    if (logo) {
        return (
            <div style={{
                position: 'absolute',
                left: '6%',
                right: '8%',
                bottom,
                height: '11.9%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'flex-start',
                pointerEvents: 'none',
                filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))'
            }}>
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
                        objectPosition: 'left bottom'
                    }}
                />
            </div>
        );
    }

    return (
        <div style={{
            position: 'absolute',
            left: '6%',
            right: '6%',
            bottom,
            maxHeight: '24%',
            display: 'flex',
            alignItems: 'flex-end',
            pointerEvents: 'none',
            filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))'
        }}>
            <div style={{
                fontFamily: T.display,
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
