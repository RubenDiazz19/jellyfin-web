import { useEffect, useRef, useState } from 'react';
import { useImageStorage } from '../../../domain/bridge/useImageStorage';
import { useMobileTheme } from '../../theme/MobileThemeProvider';

type Props = {
    src: string;
    srcs?: string[]; // Si viene con >1, rota entre ellos con crossfade.
    intervalMs?: number; // Tiempo entre cambios (default 8s).
    fadeMs?: number; // Duración del crossfade (default 1500ms).
    vignette?: number;
    itemId?: string;
    sharp?: boolean;
    /**
     * Fondo prestado (la ficha de temporada enseña el de la serie): se
     * desenfoca fuerte y se oscurece para que se lea como textura.
     */
    blurred?: boolean;
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
    vignette = 0.38, itemId, sharp = false, blurred = false
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

    const filter = blurred ? 'blur(8px) brightness(0.5)' :
        sharp ? 'saturate(1)' : 'saturate(0.9) blur(1px)';
    const transform = sharp || blurred ? 'none' : 'scale(1.015)';

    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <Crossfade
                url={current}
                fadeMs={fadeMs}
                filter={filter}
                transform={transform}
            />
            <div style={{
                position: 'absolute', inset: 0,
                background: `rgba(0,0,0,${blurred ? 0.35 : 0.08})`
            }} />
            <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,${vignette}) 100%)`
            }} />
            {/* El remate inferior funde con el fondo de la página. En desktop
                la var no existe y queda el #000 de siempre; en móvil el fondo
                va teñido por el dynamic color y un negro puro dejaría costura. */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 72%, rgba(0,0,0,0.25) 86%, rgba(0,0,0,0.65) 95%, var(--md-sys-color-surface, #000) 100%)'
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

// Cuánto tarda en aparecer una capa que estaba esperando su encuadre. Corto:
// no es un crossfade entre dos imágenes, es la primera saliendo de la nada.
const REVEAL_MS = 260;

// Tope de espera del encuadre. Es una red de seguridad, no un plazo esperado:
// el análisis y el `background-image` compiten por la MISMA descarga, así que
// en la práctica el encuadre está listo justo cuando la imagen se puede pintar.
// Solo entra en juego si el análisis se queda colgado sin resolver ni fallar.
//
// Se acota además por el fade: la capa saliente se desmonta a `fadeMs + 120`,
// así que esperar más que eso dejaría el hero en negro entre una imagen y la
// siguiente. Con el tope por debajo, la entrante siempre ha empezado a
// aparecer antes de que se vaya la que tapaba.
const FOCUS_DEADLINE_MS = 1200;

function FadeLayer({
    url, fadeIn, fadeMs, filter, transform
}: {
    url: string; fadeIn: boolean; fadeMs: number;
    filter: string; transform: string;
}) {
    const { peekFocusX, imageFocusX } = useMobileTheme();

    // Encuadre: en vertical el recorte se come casi todo el ancho de un
    // fotograma apaisado, así que se centra en donde está el detalle y no en la
    // mitad geométrica. En desktop siempre es null → 50%, el de siempre.
    //
    // Es de la CAPA y no del Backdrop porque cada capa tiene su propia imagen:
    // con un solo encuadre compartido, al rotar el carrusel la imagen que se
    // estaba yendo se recolocaba con el encuadre de la que entraba, y se veía
    // deslizarse mientras se desvanecía.
    //
    // La lectura inicial es SÍNCRONA: si ya se analizó esta imagen (el carrusel
    // que vuelve a un slide, una ficha que se reabre), este primer render ya
    // sale colocado. Con un `await` de por medio, aunque el valor estuviera en
    // memoria, React pintaba un frame centrado antes de corregir.
    const [focus, setFocus] = useState<number | null | undefined>(() => peekFocusX(url));
    const framed = focus !== undefined;
    // ¿Se supo desde el primer render? Entonces la capa nace bien puesta y no
    // tiene que esconderse a esperar nada.
    const bornFramed = useRef(framed).current;

    useEffect(() => {
        if (framed) return;
        let alive = true;
        void imageFocusX(url).then((x) => { if (alive) setFocus(x); });
        const t = setTimeout(() => {
            if (alive) setFocus((f) => (f === undefined ? null : f));
        }, Math.min(FOCUS_DEADLINE_MS, fadeMs));
        return () => { alive = false; clearTimeout(t); };
    }, [url, framed, fadeMs, imageFocusX]);

    // Una capa sin encuadre todavía no se enseña: aparecer centrada y
    // recolocarse a la vista es justo lo que se está quitando. La que ya nace
    // encuadrada y no viene de un crossfade se pinta entera de una — es el LCP
    // de la página y no hay nada que esperar.
    const [opacity, setOpacity] = useState(fadeIn || !bornFramed ? 0 : 1);
    useEffect(() => {
        if (!framed || (!fadeIn && bornFramed)) return;
        // Doble rAF: garantiza un frame pintado a opacity 0 antes de
        // transicionar (con uno solo, a veces el navegador colapsa ambos).
        const raf = requestAnimationFrame(() => {
            requestAnimationFrame(() => setOpacity(1));
        });
        return () => cancelAnimationFrame(raf);
    }, [framed, fadeIn, bornFramed]);

    return (
        <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: `${focus ?? 50}% center`,
            filter, transform,
            opacity,
            // La transición de posición ya no debería verse nunca: la capa no
            // se enseña hasta tener su encuadre. Se queda para el único caso
            // que se escapa —el encuadre llegando después del tope de arriba—,
            // donde deslizar se lee mucho mejor que saltar.
            transition: `opacity ${fadeIn ? fadeMs : REVEAL_MS}ms ease-in-out,`
                + ' background-position 420ms ease-out'
        }} />
    );
}
