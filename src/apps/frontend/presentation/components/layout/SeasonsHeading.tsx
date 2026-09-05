// Cabecera interactiva de temporadas en la ficha de serie.
// Muestra directamente «X temporadas» en tamaño compacto y, al pulsar, despliega
// el total de episodios de forma minimalista (sin caja ni barra de progreso) durante
// 4 segundos, perfectamente centrado con el texto principal.

import { useEffect, useRef, useState } from 'react';
import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';

type Props = {
    seasonCount: number;
    episodeCount: number;
    marginBottom: number;
};

export function SeasonsHeading({ seasonCount, episodeCount, marginBottom }: Props) {
    const [showEpisodes, setShowEpisodes] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cancelar el temporizador si el componente se desmonta mientras está activo.
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);

    const toggleEpisodes = () => {
        if (showEpisodes) {
            // Al pulsar de nuevo, vuelve de inmediato al estado anterior.
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            setShowEpisodes(false);
        } else {
            // Despliega y activa el temporizador interno de 4 segundos sin barra visual.
            setShowEpisodes(true);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                setShowEpisodes(false);
                timerRef.current = null;
            }, 4000);
        }
    };

    const seasonsLabel = seasonCount === 1 ?
        (globalize.translate('Season') ? `1 ${globalize.translate('Season').toLowerCase()}` : '1 temporada') :
        (globalize.translate('HeaderSeasons') ? `${seasonCount} ${globalize.translate('HeaderSeasons').toLowerCase()}` : `${seasonCount} temporadas`);

    const episodesLabel = episodeCount === 1 ?
        (globalize.translate('ValueOneEpisode') || '1 episodio') :
        (globalize.translate('ValueEpisodeCount', episodeCount) || `${episodeCount} episodios`);

    return (
        <h3
            style={{
                margin: 0,
                marginBottom,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}
        >
            <button
                type='button'
                onClick={toggleEpisodes}
                aria-expanded={showEpisodes}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                title={showEpisodes ? 'Ocultar episodios' : 'Ver episodios totales'}
                style={{
                    all: 'unset',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    userSelect: 'none'
                }}
            >
                <span
                    style={{
                        fontFamily: T.ui,
                        fontSize: 22,
                        fontWeight: 400,
                        color: T.fg,
                        letterSpacing: '-0.01em',
                        lineHeight: 1,
                        opacity: isHovered ? 0.8 : 1,
                        transition: 'opacity 0.2s ease'
                    }}
                >
                    {seasonsLabel}
                </span>

                {/* Contenedor animado para el total de episodios, centrado y sin barra ni caja */}
                <span
                    aria-hidden={!showEpisodes}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        maxWidth: showEpisodes ? 220 : 0,
                        opacity: showEpisodes ? 1 : 0,
                        transform: showEpisodes ? 'translateX(0)' : 'translateX(-6px)',
                        transition: 'max-width 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        pointerEvents: showEpisodes ? 'auto' : 'none',
                        lineHeight: 1
                    }}
                >
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginLeft: 8,
                            fontSize: 14,
                            fontFamily: T.ui,
                            color: T.dim,
                            letterSpacing: '0.01em',
                            lineHeight: 1
                        }}
                    >
                        <span style={{ marginRight: 8, opacity: 0.6 }}>·</span>
                        {episodesLabel}
                    </span>
                </span>
            </button>
        </h3>
    );
}
