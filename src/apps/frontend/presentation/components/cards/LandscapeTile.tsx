import { useState, type MouseEvent } from 'react';
import { T } from '../../theme/tokens';

type Props = {
    title: string;
    image?: string;
    logo?: string | null;
    onClick: () => void;
    onContextMenu?: (e: MouseEvent) => void;
    contextMenu?: React.ReactNode;
};

/**
 * Tarjeta apaisada 16:9 al estilo Disney+ para series, películas y episodios.
 * Fondo de backdrop, logo o título integrado, y animación suave al foco.
 */
export function LandscapeTile({
    title,
    image,
    logo,
    onClick,
    onContextMenu,
    contextMenu
}: Props) {
    const [hovered, setHovered] = useState(false);

    return (
        <>
            <div
                onClick={onClick}
                onContextMenu={onContextMenu}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    borderRadius: 10,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: '#151821',
                    border: `2px solid ${hovered ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: hovered ?
                        '0 14px 32px rgba(0,0,0,0.8), 0 0 16px rgba(255,255,255,0.15)' :
                        '0 4px 16px rgba(0,0,0,0.4)',
                    transform: hovered ? 'translateY(-4px) scale(1.02)' : 'none',
                    transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1), box-shadow 200ms ease, border-color 200ms ease',
                    userSelect: 'none'
                }}
            >
                {image && (
                    <img
                        src={image}
                        alt=''
                        loading='lazy'
                        decoding='async'
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center',
                            transform: hovered ? 'scale(1.04)' : 'none',
                            transition: 'transform 300ms ease'
                        }}
                    />
                )}

                <div style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.85) 100%)'
                }} />

                {logo ? (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-start',
                        padding: '12px 14px',
                        pointerEvents: 'none'
                    }}>
                        <img
                            src={logo}
                            alt={title}
                            loading='lazy'
                            style={{
                                maxHeight: '45%',
                                maxWidth: '75%',
                                objectFit: 'contain',
                                objectPosition: 'left bottom',
                                filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))'
                            }}
                        />
                    </div>
                ) : (
                    <div style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 14,
                        right: 14,
                        fontFamily: T.ui,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#fff',
                        textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    }}>
                        {title}
                    </div>
                )}
            </div>
            {contextMenu}
        </>
    );
}
