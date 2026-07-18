import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { getSystemInfo, refreshLibrary, dashboardUrl } from '../../../domain/api';
import type { SystemInfo } from '../../../domain/api';
import { useToast } from '../toast/ToastProvider';

type Props = { onClose: () => void };

// Modal ligero con las acciones de admin más habituales: rescan de biblioteca,
// info del servidor, y atajo al dashboard nativo de Jellyfin.
export function AdminPanel({ onClose }: Props) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    getSystemInfo()
      .then((data) => { if (!cancelled) setInfo(data); })
      .catch((err: Error) => { if (!cancelled) setInfoError(err.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const doRescan = async () => {
    setRefreshing(true);
    try {
      await refreshLibrary();
      toast('Escaneo lanzado — puede tardar unos segundos', 'success');
    } catch (err) {
      toast((err as Error).message, 'warn');
    } finally {
      setRefreshing(false);
    }
  };

  const openDashboard = () => {
    const url = dashboardUrl();
    if (url) window.open(url, '_blank', 'noopener');
  };

  return ReactDOM.createPortal(
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'rgba(20,20,22,0.98)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
          fontFamily: T.ui, color: '#fff',
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '18px 22px', display: 'flex', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0.2 }}>
            Panel de administración
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: T.dim, fontSize: 20, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 22 }}>
          <SectionLabel>Servidor</SectionLabel>
          {infoError ? (
            <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 20 }}>
              {infoError}
            </div>
          ) : info ? (
            <div style={{
              display: 'grid', gridTemplateColumns: '110px 1fr',
              rowGap: 8, fontSize: 13, marginBottom: 24,
            }}>
              <span style={{ color: T.dim }}>Nombre</span><span>{info.serverName}</span>
              <span style={{ color: T.dim }}>Versión</span><span>{info.version}</span>
              <span style={{ color: T.dim }}>SO</span>
              <span>{info.operatingSystem || '—'}</span>
            </div>
          ) : (
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 20 }}>Cargando…</div>
          )}

          <SectionLabel>Acciones</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AdminAction
              label={refreshing ? 'Escaneando…' : 'Reescanear biblioteca'}
              hint="Detecta archivos nuevos y actualiza metadatos."
              disabled={refreshing}
              onClick={doRescan}
              icon={<Ic.Arrow size={14} />}
            />
            <AdminAction
              label="Abrir dashboard nativo"
              hint="Panel oficial de Jellyfin en pestaña nueva."
              onClick={openDashboard}
              icon={<Ic.Plus size={14} />}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
      color: T.dim, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function AdminAction({
  label, hint, onClick, disabled, icon,
}: {
  label: string; hint: string; onClick: () => void;
  disabled?: boolean; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', textAlign: 'left',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
        color: disabled ? T.dim : '#fff', fontFamily: T.ui,
        cursor: disabled ? 'wait' : 'pointer',
        transition: 'background .15s, border-color .15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
      }}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: T.dim }}>{hint}</span>
      </span>
    </button>
  );
}
