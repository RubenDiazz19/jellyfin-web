import {
    createContext, useCallback, useContext, useEffect, useRef, useState,
    type ReactNode
} from 'react';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { aboveNav, besideNav } from '../nav/navMetrics';
import { DRAG_THRESHOLD, dragVelocity, shouldDismiss } from '../../../shared/dragDismiss';

type ToastKind = 'info' | 'success' | 'warn';
type Toast = { id: number; message: string; kind: ToastKind };
type ToastContextValue = {
    toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Duraciones diferenciadas: info/warn dan más tiempo a leer, success es
// feedback inmediato para gestos frecuentes (fav/visto) y se aparta antes.
const DURATIONS: Record<ToastKind, number> = { info: 3500, success: 2200, warn: 4000 };

// Recorrido horizontal (px) que descarta un snackbar al soltar.
const SWIPE_DISMISS_DISTANCE = 72;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idRef = useRef(0);
    // Timers de auto-cierre por id: el descarte manual (swipe) los cancela
    // para no llamar dos veces a la baja.
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    const dismiss = useCallback((id: number) => {
        const t = timers.current.get(id);
        if (t) { clearTimeout(t); timers.current.delete(id); }
        setToasts((list) => list.filter((x) => x.id !== id));
    }, []);

    const toast = useCallback((message: string, kind: ToastKind = 'success') => {
        const id = ++idRef.current;
        setToasts((t) => [...t, { id, message, kind }]);
        timers.current.set(id, setTimeout(() => dismiss(id), DURATIONS[kind]));
    }, [dismiss]);

    // Limpia timers pendientes si el provider se desmonta.
    useEffect(() => {
        const map = timers.current;
        return () => {
            map.forEach((t) => { clearTimeout(t); });
            map.clear();
        };
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <Toaster toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue['toast'] {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx.toast;
}

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
    const r = useResponsive();
    // En táctil el snackbar se apila abajo, por encima de la píldora de
    // navegación (o del rail, que no ocupa la franja inferior). En desktop,
    // centrado como hasta ahora.
    const wrapStyle = r.touch ? {
        position: 'fixed' as const,
        left: besideNav(r.pagePad), right: r.pagePad,
        bottom: aboveNav(12),
        display: 'flex', flexDirection: 'column-reverse' as const, gap: 8,
        alignItems: 'stretch' as const,
        zIndex: 9998, pointerEvents: 'none' as const
    } : {
        position: 'fixed' as const, left: '50%', bottom: 32, transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column-reverse' as const, gap: 10,
        zIndex: 9998, pointerEvents: 'none' as const
    };
    return (
        <div style={wrapStyle}>
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} touch={r.touch} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function ToastItem({ toast, touch, onDismiss }: { toast: Toast; touch: boolean; onDismiss: (id: number) => void }) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const raf = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    // Swipe horizontal para descartar (solo táctil). El estado del gesto vive
    // en un ref; solo `dx`/`leaving` disparan render. touch-action: pan-y deja
    // el scroll vertical al navegador y nos entrega el gesto horizontal, así
    // que no hace falta preventDefault (ni listeners no pasivos).
    const [dx, setDx] = useState(0);
    const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
    // Se guardan las dos últimas muestras: la velocidad de salida se mide
    // sobre el tramo final, no sobre el gesto entero (arrastrar despacio y
    // parar no descarta; un flick corto sí).
    const g = useRef({
        tracking: false, active: false,
        startX: 0, lastX: 0, lastT: 0, prevX: 0, prevT: 0
    });

    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const x = e.touches[0].clientX;
        g.current = {
            tracking: true, active: false,
            startX: x, lastX: x, lastT: e.timeStamp, prevX: x, prevT: e.timeStamp
        };
    };
    const onTouchMove = (e: React.TouchEvent) => {
        if (!g.current.tracking) return;
        const x = e.touches[0].clientX;
        const d = x - g.current.startX;
        if (!g.current.active) {
            if (Math.abs(d) < DRAG_THRESHOLD) return;
            g.current.active = true;
        }
        setDx(d);
        g.current.prevX = g.current.lastX;
        g.current.prevT = g.current.lastT;
        g.current.lastX = x;
        g.current.lastT = e.timeStamp;
    };
    const onTouchEnd = () => {
        if (!g.current.active) { g.current.tracking = false; return; }
        g.current.tracking = false;
        g.current.active = false;
        // touchend no trae posición nueva: se cierra con las dos últimas
        // muestras del move.
        const distance = Math.abs(g.current.lastX - g.current.startX);
        const v = dragVelocity(
            g.current.lastX - g.current.prevX,
            g.current.lastT - g.current.prevT
        );
        if (shouldDismiss(distance, v, SWIPE_DISMISS_DISTANCE)) {
            const dir = g.current.lastX < g.current.startX ? -1 : 1;
            setLeaving(dir); // desliza fuera hacia el lado del gesto
            window.setTimeout(() => onDismiss(toast.id), 200);
        } else {
            setDx(0); // vuelve a su sitio
        }
    };

    if (touch) {
        // Snackbar M3: superficie inversa, esquina extra-small, elevación 3.
        // El acento (warn/info) va en una barra lateral para no perder el
        // contraste del texto sobre inverse-surface.
        const accent =
            toast.kind === 'warn' ? 'var(--md-sys-color-error, #ffb4ab)' :
                toast.kind === 'info' ? 'var(--md-sys-color-primary, #a8c8ff)' :
                    'transparent';
        const swiping = dx !== 0 || leaving !== 0;
        const shownX = leaving !== 0 ? leaving * (window.innerWidth || 400) : dx;
        // La opacidad cae con el recorrido: refuerza que el gesto descarta.
        const swipeOpacity = leaving !== 0 ? 0 : Math.max(0, 1 - Math.abs(dx) / 240);
        return (
            <div
                role='status'
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
                style={{
                    pointerEvents: 'auto',
                    touchAction: 'pan-y',
                    display: 'flex', alignItems: 'center',
                    background: 'var(--md-sys-color-inverse-surface, #2f3033)',
                    color: 'var(--md-sys-color-inverse-on-surface, #f1f0f4)',
                    borderLeft: `4px solid ${accent}`,
                    borderRadius: 'var(--md-sys-shape-corner-extra-small, 4px)',
                    padding: '14px 16px',
                    fontFamily: T.ui,
                    fontSize: 'var(--md-sys-typescale-body-medium-size, 14px)',
                    boxShadow: 'var(--md-sys-elevation-level3, 0 8px 24px rgba(0,0,0,0.5))',
                    opacity: visible ? swipeOpacity : 0,
                    transform: visible ? `translateX(${shownX}px)` : 'translateY(12px)',
                    // Sin transición mientras el dedo arrastra (sigue al tacto);
                    // con transición al soltar (spring-back o salida).
                    transition: swiping && dx !== 0 && leaving === 0 ?
                        'none' :
                        'opacity .25s ease, transform .25s ease'
                }}
            >
                {toast.message}
            </div>
        );
    }

    const border =
    toast.kind === 'warn' ? 'rgba(255,180,80,0.55)' :
        toast.kind === 'info' ? 'rgba(150,200,255,0.45)' :
            'rgba(255,255,255,0.35)';

    return (
        <div
            style={{
                pointerEvents: 'auto',
                background: 'rgba(20,20,22,0.9)', color: T.fg,
                backdropFilter: 'blur(14px) saturate(160%)',
                WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                border: `1px solid ${border}`,
                borderRadius: 999, padding: '10px 18px',
                fontFamily: T.ui, fontSize: 13, letterSpacing: 0.2,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity .25s ease, transform .25s ease',
                maxWidth: 420
            }}
        >
            {toast.message}
        </div>
    );
}
