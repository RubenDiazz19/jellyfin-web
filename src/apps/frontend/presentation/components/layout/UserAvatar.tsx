import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import { useSession } from '../../../domain/bridge/useSession';
import { useToast } from '../toast/ToastProvider';
import { BottomSheet } from '../m3/BottomSheet';
import { useResponsive } from '../../theme/responsive';
import type { Navigate } from '../../../app/router';

// Avatar circular con menú desplegable (perfil, ajustes, logout).
// Antes era decorativo; ahora usa la sesión activa como fuente de verdad.
// La administración vive centralizada en Ajustes (secciones Bibliotecas/
// Servidor/Usuarios), no como entrada aparte del menú.
export function UserAvatar({ navigate }: { navigate: Navigate }) {
    const { session, logout } = useSession();
    const toast = useToast();
    const r = useResponsive();
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const initial = (session?.displayName ?? '?').slice(0, 1).toUpperCase();

    useEffect(() => {
        if (!open || r.touch) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, r.touch]);

    const openMenu = () => {
        if (open) { setOpen(false); return; }
        // En táctil el menú es un bottom sheet (no hace falta anclar).
        if (!r.touch) {
            const rect = ref.current?.getBoundingClientRect();
            if (rect) setPos({ top: rect.bottom + 10, right: Math.max(12, window.innerWidth - rect.right) });
        }
        setOpen(true);
    };

    const item = (label: string, onClick: () => void, danger = false) => (
        <button
            data-ripple={r.touch ? '' : undefined}
            onClick={() => { setOpen(false); onClick(); }}
            style={r.touch ? {
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none',
                color: danger ? 'var(--md-sys-color-error, #ff6b6b)' : 'var(--md-sys-color-on-surface, #fff)',
                cursor: 'pointer', minHeight: 48, padding: '12px 16px',
                fontSize: 15, borderRadius: 'var(--md-sys-shape-corner-large, 16px)',
                fontFamily: T.ui
            } : {
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none',
                color: danger ? '#ff6b6b' : '#fff',
                cursor: 'pointer', padding: '11px 14px',
                fontSize: 14, borderRadius: 8, fontFamily: T.ui, letterSpacing: 0.1,
                transition: 'background .15s'
            }}
            onMouseEnter={(e) => { if (!r.touch) e.currentTarget.style.background = danger ? 'rgba(255,80,80,0.12)' : 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { if (!r.touch) e.currentTarget.style.background = 'transparent'; }}
        >
            {label}
        </button>
    );

    const menuItems = (
        <>
            {item('Perfil', () => navigate({ page: 'profile' }))}
            {item('Ajustes', () => navigate({ page: 'settings' }))}
            {item('Cambiar usuario', () => {
                toast('Sesión cerrada — inicia con otro usuario', 'info');
                logout();
            })}
            {item('Cerrar sesión', () => {
                toast('Sesión cerrada', 'info');
                logout();
            }, true)}
        </>
    );

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={openMenu}
                aria-label='Cuenta'
                style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#d9a566,#3a1f10)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', fontFamily: T.ui, fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0
                }}
            >
                {initial}
            </button>
            {/* Táctil: bottom sheet M3. Desktop: popup anclado (sin cambios). */}
            {open && r.touch && (
                <BottomSheet
                    title={session?.displayName ?? 'Invitado'}
                    onClose={() => setOpen(false)}
                >
                    {menuItems}
                </BottomSheet>
            )}
            {open && !r.touch && pos && ReactDOM.createPortal(
                <div
                    style={{
                        position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999,
                        minWidth: 240,
                        background: 'rgba(18,18,20,0.96)', backdropFilter: 'blur(14px)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 6,
                        boxShadow: '0 18px 50px rgba(0,0,0,0.6)'
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div style={{
                        padding: '10px 14px 8px',
                        fontSize: 13, color: '#fff', fontWeight: 500
                    }}>
                        {session?.displayName ?? 'Invitado'}
                    </div>
                    <div style={{ padding: '0 14px 10px', fontSize: 11, color: T.dim, wordBreak: 'break-all' }}>
                        {session?.serverUrl}
                    </div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0 6px' }} />
                    {item('Perfil', () => navigate({ page: 'profile' }))}
                    {item('Ajustes', () => navigate({ page: 'settings' }))}
                    {item('Cambiar usuario', () => {
                        toast('Sesión cerrada — inicia con otro usuario', 'info');
                        logout();
                    })}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />
                    {item('Cerrar sesión', () => {
                        toast('Sesión cerrada', 'info');
                        logout();
                    }, true)}
                </div>,
                document.body
            )}
        </div>
    );
}
