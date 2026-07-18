import { useEffect, useState } from 'react';
import { useImageStorage } from '../../../domain/bridge/useImageStorage';

type Props = {
    src: string;
    srcs?: string[]; // Si viene con >1, rota entre ellos con crossfade.
    intervalMs?: number; // Tiempo entre cambios (default 8s).
    fadeMs?: number; // Duración del crossfade (default 1500ms).
    fadeBottom?: number;
    vignette?: number;
    itemId?: string;
    sharp?: boolean;
};

// Fondo de hero: imagen a pantalla completa con veladura + vignette + fade
// inferior para que el texto se lea encima sin tapar la imagen. Si se le
// pasan varios `srcs`, va alternando con un crossfade suave.
export function Backdrop({
    src, srcs, intervalMs = 8000, fadeMs = 1500,
    vignette = 0.38, itemId, sharp = false
}: Props) {
    const { getImage } = useImageStorage();
    const customBackdrop = itemId ? getImage(`${itemId}_backdrop`) : null;

    const pool = (srcs && srcs.length > 0 ? srcs : [src]).filter(Boolean);
    const initial = customBackdrop || pool[0] || src;

    const [idx, setIdx] = useState(0);
    useEffect(() => { setIdx(0); }, [pool.length, initial]);
    useEffect(() => {
        if (customBackdrop || pool.length <= 1) return;
        const t = setInterval(() => setIdx((n) => (n + 1) % pool.length), intervalMs);
        return () => clearInterval(t);
    }, [pool.length, intervalMs, customBackdrop]);

    const filter = sharp ? 'saturate(1)' : 'saturate(0.9) blur(1px)';
    const transform = sharp ? 'none' : 'scale(1.015)';

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            {customBackdrop || pool.length <= 1 ? (
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${initial})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    filter, transform
                }} />
            ) : (
                pool.map((url, i) => (
                    <div key={url} style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url(${url})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        filter, transform,
                        opacity: i === idx ? 1 : 0,
                        transition: `opacity ${fadeMs}ms ease-in-out`
                    }} />
                ))
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.08)' }} />
            <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,${vignette}) 100%)`
            }} />
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 72%, rgba(0,0,0,0.25) 86%, rgba(0,0,0,0.65) 95%, #000 100%)'
            }} />
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 160,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.30), transparent)'
            }} />
        </div>
    );
}
