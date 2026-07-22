import { useEffect, useRef, useState } from 'react';
import { useImageStorage } from '../../../domain/bridge/useImageStorage';
import { useMobileTheme } from '../../theme/MobileThemeProvider';

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
//
// Rendimiento: solo viven en el DOM la imagen activa y (durante el fade) la
// anterior — antes se montaban TODOS los backdrops y el navegador los
// descargaba aunque estuvieran a opacity 0. La siguiente del ciclo se
// precarga con `new Image()` para que el crossfade no parpadee.
export function Backdrop({
    src, srcs, intervalMs = 8000, fadeMs = 1500,
    vignette = 0.38, itemId, sharp = false
}: Props) {
    const { getImage } = useImageStorage();
    const customBackdrop = itemId ? getImage(`${itemId}_backdrop`) : null;

    const pool = (srcs && srcs.length > 0 ? srcs : [src]).filter(Boolean);
    const [idx, setIdx] = useState(0);
    useEffect(() => { setIdx(0); }, [pool.length, customBackdrop]);
    useEffect(() => {
        if (customBackdrop || pool.length <= 1) return;
        const t = setInterval(() => setIdx((n) => (n + 1) % pool.length), intervalMs);
        return () => clearInterval(t);
    }, [pool.length, intervalMs, customBackdrop]);

    const current = customBackdrop || pool[Math.min(idx, pool.length - 1)] || src;

    // Dynamic color M3: la seed del tema sigue al backdrop visible. En
    // desktop applyImageSeed es un no-op (el provider queda inerte).
    const { applyImageSeed } = useMobileTheme();
    useEffect(() => {
        if (current) applyImageSeed(current);
    }, [current, applyImageSeed]);

    // La hero image es el LCP de la página y via background-image el
    // navegador la pide con prioridad baja: un preload hint la adelanta.
    useEffect(() => {
        if (!current) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = current;
        link.fetchPriority = 'high';
        document.head.appendChild(link);
        return () => { link.remove(); };
    }, [current]);

    // Precarga la siguiente del ciclo para que el crossfade entre a imagen
    // ya descargada.
    useEffect(() => {
        if (customBackdrop || pool.length <= 1) return;
        const next = pool[(idx + 1) % pool.length];
        if (next) {
            const img = new Image();
            img.src = next;
        }
    }, [idx, pool, customBackdrop]);

    const filter = sharp ? 'saturate(1)' : 'saturate(0.9) blur(1px)';
    const transform = sharp ? 'none' : 'scale(1.015)';

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <Crossfade url={current} fadeMs={fadeMs} filter={filter} transform={transform} />
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

// Doble búfer: mantiene como mucho dos capas (saliente + entrante). La
// entrante monta a opacity 0 y transiciona a 1; la saliente se desmonta al
// terminar el fade.
function Crossfade({
    url, fadeMs, filter, transform
}: {
    url: string; fadeMs: number; filter: string; transform: string;
}) {
    const keyRef = useRef(0);
    const [layers, setLayers] = useState<{ url: string; key: number }[]>(
        () => [{ url, key: 0 }]
    );

    useEffect(() => {
        setLayers((prev) => {
            if (prev[prev.length - 1]?.url === url) return prev;
            keyRef.current++;
            // Conserva solo la última capa como "saliente" + la nueva.
            return [...prev.slice(-1), { url, key: keyRef.current }];
        });
    }, [url]);

    useEffect(() => {
        if (layers.length <= 1) return;
        const t = setTimeout(() => setLayers((p) => p.slice(-1)), fadeMs + 120);
        return () => clearTimeout(t);
    }, [layers, fadeMs]);

    return (
        <>
            {layers.map((l, i) => (
                <FadeLayer
                    key={l.key}
                    url={l.url}
                    fadeIn={layers.length > 1 && i === layers.length - 1}
                    fadeMs={fadeMs}
                    filter={filter}
                    transform={transform}
                />
            ))}
        </>
    );
}

function FadeLayer({
    url, fadeIn, fadeMs, filter, transform
}: {
    url: string; fadeIn: boolean; fadeMs: number; filter: string; transform: string;
}) {
    const [opacity, setOpacity] = useState(fadeIn ? 0 : 1);
    useEffect(() => {
        if (!fadeIn) return;
        // Doble rAF: garantiza un frame pintado a opacity 0 antes de
        // transicionar (con uno solo, a veces el navegador colapsa ambos).
        const raf = requestAnimationFrame(() => {
            requestAnimationFrame(() => setOpacity(1));
        });
        return () => cancelAnimationFrame(raf);
    }, [fadeIn]);
    return (
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter, transform,
            opacity,
            transition: `opacity ${fadeMs}ms ease-in-out`
        }} />
    );
}
