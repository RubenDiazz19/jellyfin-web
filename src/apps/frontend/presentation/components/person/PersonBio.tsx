import { useState } from 'react';
import { T } from '../../theme/tokens';

type PersonBioProps = {
    bio: string;
    isWidescreen?: boolean;
};

/**
 * Párrafo de biografía desplegable con animación de clamp y cursor para alternar
 * entre vista truncada y expandida.
 */
export function PersonBio({ bio, isWidescreen }: PersonBioProps) {
    const [bioExpanded, setBioExpanded] = useState(false);

    if (isWidescreen) {
        return (
            <div
                onClick={() => setBioExpanded(!bioExpanded)}
                style={{ maxWidth: 780, cursor: 'pointer', userSelect: 'none' }}
            >
                <p style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: 'rgba(255, 255, 255, 0.72)',
                    fontFamily: T.ui,
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: bioExpanded ? 'unset' : 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: bioExpanded ? 'visible' : 'hidden'
                }}>
                    {bio}
                </p>
            </div>
        );
    }

    return (
        <div
            onClick={() => setBioExpanded(!bioExpanded)}
            style={{
                maxWidth: 720,
                margin: '28px auto 0',
                padding: '0 24px',
                cursor: 'pointer',
                textAlign: 'center',
                userSelect: 'none'
            }}
        >
            <p style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: T.ui,
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: bioExpanded ? 'unset' : 3,
                WebkitBoxOrient: 'vertical',
                overflow: bioExpanded ? 'visible' : 'hidden'
            }}>
                {bio}
            </p>
        </div>
    );
}
