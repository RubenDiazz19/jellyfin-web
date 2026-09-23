// Reproductor de fondo para el trailer del Hero en la Home.
// Solo soporta streams nativos de Jellyfin (DirectPlay / HLS).

import { useEffect, useRef, useState } from 'react';
import type { TrailerSource } from '../../../domain/viewModels/HeroTrailerViewModel';
import { attachHlsSource } from '../../../domain/player/hlsSource';
import { Ic } from '../../theme/icons';

type Props = {
    source: TrailerSource;
    isMuted: boolean;
    isPaused: boolean;
    onToggleMute?: () => void;
    onError: (err?: unknown) => void;
    onPlaying?: () => void;
};

export function HeroTrailerVideo({
    source,
    isMuted,
    isPaused,
    onToggleMute,
    onError,
    onPlaying
}: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [loaded, setLoaded] = useState(false);

    // Manejo de vídeo directo / HLS
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let closed = false;
        let hlsInstance: { destroy: () => void } | null = null;

        if (source.isHls) {
            void attachHlsSource(video, source.url, {
                isClosed: () => closed,
                onUnrecoverable: () => {
                    if (!closed) onError();
                }
            }).then((res) => {
                if (closed) {
                    if (res.status === 'attached') res.hls.destroy();
                    return;
                }
                if (res.status === 'attached') {
                    hlsInstance = res.hls;
                    void video.play().catch(() => {});
                } else if (res.status === 'unsupported') {
                    onError();
                }
            });
        } else {
            video.src = source.url;
            void video.play().catch(() => {});
        }

        return () => {
            closed = true;
            if (hlsInstance) hlsInstance.destroy();
            video.removeAttribute('src');
            video.load();
        };
    }, [source, onError]);

    // Pausar y reanudar vídeo según visibilidad
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (isPaused) {
            video.pause();
        } else {
            void video.play().catch(() => {});
        }
    }, [isPaused]);

    // Sincronizar silencio
    useEffect(() => {
        const video = videoRef.current;
        if (video) video.muted = isMuted;
    }, [isMuted]);

    const handleVideoPlaying = () => {
        setLoaded(true);
        onPlaying?.();
    };

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                pointerEvents: 'none',
                background: '#000'
            }}
        >
            <video
                ref={videoRef}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                onPlaying={handleVideoPlaying}
                onError={onError}
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scale(1.35)',
                    opacity: loaded ? 1 : 0,
                    transition: 'opacity 0.6s ease',
                    pointerEvents: 'none'
                }}
            >
                <track kind='captions' />
            </video>
            
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'linear-gradient(to bottom, transparent 38%, rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.65) 80%, #000 98%)'
            }} />
        </div>
    );
}
