// Bottom sheet M3 (solo lo montan componentes en mobile/tablet). Portal a
// body con scrim, asa de arrastre, esquinas superiores extra-large y respeto
// de la safe-area inferior.
//
// Gesto de cierre (M3 "drag-to-dismiss"): arrastrar el sheet hacia abajo lo
// sigue con el dedo y lo descarta al soltar si se supera el umbral por
// recorrido o por velocidad (dragDismiss.ts). El arrastre solo se engancha
// cuando el scroll interior está arriba del todo — así, con el contenido
// scrolleado, el dedo mueve la lista y no el sheet.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactDOM from 'react-dom';

import { DRAG_THRESHOLD, dragVelocity, shouldDismiss } from '../../../shared/dragDismiss';

type Props = {
    title?: string;
    onClose: () => void;
    children: ReactNode;
};

const SETTLE_MS = 250;

export function BottomSheet({ title, onClose, children }: Props) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState(0);
    // `settling`: hay una transición en curso (spring-back o salida). Activa la
    // transición CSS; durante el arrastre en vivo está apagada (sigue al dedo).
    const [settling, setSettling] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Gesto de arrastre: listeners nativos porque touchmove debe ser
    // NO pasivo (preventDefault frena el scroll del documento durante el
    // arrastre). El estado del gesto vive en un ref: no provoca renders.
    useEffect(() => {
        const el = sheetRef.current;
        if (!el) return;

        const drag = {
            tracking: false, // hay un dedo abajo, aún sin decidir dirección
            active: false, // el arrastre ya se apropió del gesto
            startY: 0,
            // Última muestra y la anterior: la velocidad de salida se mide
            // sobre el tramo entre las dos, no sobre el gesto entero (soltar
            // tras un flick descarta; frenar antes de soltar, no).
            lastY: 0,
            lastT: 0,
            prevY: 0,
            prevT: 0
        };

        const onStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const y = e.touches[0].clientY;
            drag.tracking = true;
            drag.active = false;
            drag.startY = y;
            drag.lastY = y;
            drag.lastT = e.timeStamp;
            drag.prevY = y;
            drag.prevT = e.timeStamp;
            setSettling(false);
        };

        const onMove = (e: TouchEvent) => {
            if (!drag.tracking) return;
            const y = e.touches[0].clientY;
            const dy = y - drag.startY;

            if (!drag.active) {
                // Solo nos apropiamos si el gesto es hacia abajo, supera el
                // umbral y el contenido está arriba del todo (si no, es scroll).
                if (dy > DRAG_THRESHOLD && el.scrollTop <= 0) {
                    drag.active = true;
                } else if (dy < 0 || el.scrollTop > 0) {
                    // Hacia arriba o con scroll pendiente: cedemos al scroll.
                    drag.tracking = false;
                    return;
                } else {
                    return;
                }
            }

            // Ya arrastrando: frena el scroll y sigue al dedo (solo hacia
            // abajo; un pequeño rebote elástico hacia arriba).
            e.preventDefault();
            const next = dy < 0 ? dy / 6 : dy;
            setOffset(Math.max(0, next));
            drag.prevY = drag.lastY;
            drag.prevT = drag.lastT;
            drag.lastY = y;
            drag.lastT = e.timeStamp;
        };

        const onEnd = () => {
            if (!drag.active) { drag.tracking = false; return; }
            drag.tracking = false;
            drag.active = false;

            // touchend no trae coordenadas útiles (changedTouches repite la
            // última posición), así que se cierra con las dos últimas muestras
            // del move.
            const distance = Math.max(0, drag.lastY - drag.startY);
            const v = dragVelocity(drag.lastY - drag.prevY, drag.lastT - drag.prevT);

            setSettling(true);
            if (shouldDismiss(distance, v)) {
                // Sale por abajo y cierra al acabar la transición.
                const h = el.getBoundingClientRect().height || window.innerHeight;
                setOffset(h);
                window.setTimeout(onClose, SETTLE_MS);
            } else {
                setOffset(0); // vuelve a su sitio
                window.setTimeout(() => setSettling(false), SETTLE_MS);
            }
        };

        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove', onMove, { passive: false });
        el.addEventListener('touchend', onEnd, { passive: true });
        el.addEventListener('touchcancel', onEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
            el.removeEventListener('touchend', onEnd);
            el.removeEventListener('touchcancel', onEnd);
        };
    }, [onClose]);

    // El scrim se atenúa a medida que el sheet baja (feedback del arrastre).
    const dragProgress = offset > 0 && sheetRef.current ?
        Math.min(1, offset / (sheetRef.current.getBoundingClientRect().height || 400)) :
        0;

    // Mientras offset es 0 y no hay settle, NO fijamos transform: así corre la
    // animación de entrada (jfp-sheet-in) sin que un transform inline la pise.
    const dragging = offset > 0 || settling;

    return ReactDOM.createPortal(
        <div
            // Cierra solo si el tap cae en el scrim (no dentro del sheet).
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            // El cierre-por-mousedown-fuera de quien nos abre (MoreButton) no
            // debe tragarse los taps dentro del sheet.
            onMouseDown={(e) => e.stopPropagation()}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
                background: `rgba(0, 0, 0, ${0.5 * (1 - dragProgress)})`,
                animation: 'jfp-fade-in 0.2s ease-out both'
            }}
        >
            <div
                ref={sheetRef}
                role='dialog'
                aria-label={title ?? 'Opciones'}
                style={{
                    position: 'fixed',
                    right: 0,
                    bottom: 0,
                    left: 0,
                    zIndex: 9999,
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    touchAction: 'pan-y',
                    margin: '0 auto',
                    maxWidth: 560,
                    padding: '8px 8px calc(16px + env(safe-area-inset-bottom, 0px))',
                    background: 'var(--md-sys-color-surface-container, #1b1b1f)',
                    color: 'var(--md-sys-color-on-surface, #fff)',
                    borderRadius: 'var(--md-sys-shape-corner-extra-large-top, 28px 28px 0 0)',
                    boxShadow: 'var(--md-sys-elevation-level3, 0 -8px 24px rgba(0,0,0,0.5))',
                    ...(dragging ?
                        { transform: `translateY(${offset}px)` } :
                        { animation: 'jfp-sheet-in var(--md-sys-motion-duration-medium2, 0.25s) var(--md-sys-motion-easing-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1)) both' }),
                    transition: settling ?
                        `transform ${SETTLE_MS}ms var(--md-sys-motion-easing-emphasized, cubic-bezier(0.2, 0, 0, 1))` :
                        'none'
                }}
            >
                <div style={{
                    width: 32,
                    height: 4,
                    margin: '8px auto 12px',
                    borderRadius: 999,
                    background: 'var(--md-sys-color-outline-variant, rgba(255,255,255,0.25))'
                }}
                />
                {title && (
                    <div style={{
                        padding: '0 16px 10px',
                        fontSize: 'var(--md-sys-typescale-title-small-size, 14px)',
                        fontWeight: 500,
                        color: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.65))',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                    }}
                    >
                        {title}
                    </div>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}
