import {
    createContext, useCallback, useContext, useEffect, useRef, useState,
    type ReactNode
} from 'react';
import { T } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';

type ToastKind = 'info' | 'success' | 'warn';
type Toast = { id: number; message: string; kind: ToastKind };
type ToastContextValue = {
    toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Duraciones diferenciadas: info/warn dan más tiempo a leer, success es
// feedback inmediato para gestos frecuentes (fav/visto) y se aparta antes.
const DURATIONS: Record<ToastKind, number> = { info: 3500, success: 2200, warn: 4000 };

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idRef = useRef(0);

    const toast = useCallback((message: string, kind: ToastKind = 'success') => {
        const id = ++idRef.current;
        setToasts((t) => [...t, { id, message, kind }]);
        setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== id));
        }, DURATIONS[kind]);
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <Toaster toasts={toasts} />
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue['toast'] {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx.toast;
}

function Toaster({ toasts }: { toasts: Toast[] }) {
    const r = useResponsive();
    // En táctil el snackbar se apila abajo, por encima de la bottom nav (o
    // del rail, que no ocupa la franja inferior). En desktop, centrado como
    // hasta ahora.
    const wrapStyle = r.touch ? {
        position: 'fixed' as const,
        left: r.pagePad, right: r.pagePad,
        bottom: `calc(${r.mobile ? 92 : 16}px + env(safe-area-inset-bottom, 0px))`,
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
                <ToastItem key={t.id} toast={t} touch={r.touch} />
            ))}
        </div>
    );
}

function ToastItem({ toast, touch }: { toast: Toast; touch: boolean }) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const raf = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    if (touch) {
        // Snackbar M3: superficie inversa, esquina extra-small, elevación 3.
        // El acento (warn/info) va en una barra lateral para no perder el
        // contraste del texto sobre inverse-surface.
        const accent =
            toast.kind === 'warn' ? 'var(--md-sys-color-error, #ffb4ab)' :
                toast.kind === 'info' ? 'var(--md-sys-color-primary, #a8c8ff)' :
                    'transparent';
        return (
            <div
                role='status'
                style={{
                    pointerEvents: 'auto',
                    display: 'flex', alignItems: 'center',
                    background: 'var(--md-sys-color-inverse-surface, #2f3033)',
                    color: 'var(--md-sys-color-inverse-on-surface, #f1f0f4)',
                    borderLeft: `4px solid ${accent}`,
                    borderRadius: 'var(--md-sys-shape-corner-extra-small, 4px)',
                    padding: '14px 16px',
                    fontFamily: T.ui,
                    fontSize: 'var(--md-sys-typescale-body-medium-size, 14px)',
                    boxShadow: 'var(--md-sys-elevation-level3, 0 8px 24px rgba(0,0,0,0.5))',
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'translateY(0)' : 'translateY(12px)',
                    transition: 'opacity .25s ease, transform .25s ease'
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
