import { useState } from 'react';
import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { notifySessionChanged } from '../../data/session/session';
import { authenticate, normalizeServerUrl } from '../../data/api';
import { useToast } from '../components/toast/ToastProvider';

// Two-step login: pick server, then username + password. On success the auth
// module updates ServerConnections and we fan-out SESSION_EVENT so the rest
// of the tree re-renders authed.

type Step = 'server' | 'login';

export function LoginPage() {
  const [step, setStep] = useState<Step>(() =>
    localStorage.getItem('jfp-server-url') ? 'login' : 'server',
  );
  const [serverUrl, setServerUrl] = useState<string>(
    () => localStorage.getItem('jfp-server-url') ?? '',
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const chooseServer = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized) return;
    setServerUrl(normalized);
    localStorage.setItem('jfp-server-url', normalized);
    setStep('login');
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      const auth = await authenticate(serverUrl.trim(), username.trim(), password);
      notifySessionChanged();
      toast(`Sesión iniciada como ${auth.displayName}`, 'success');
    } catch (err) {
      toast((err as Error).message || 'No se pudo iniciar sesión', 'warn');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh', width: '100%',
        background: 'radial-gradient(ellipse at 30% 20%, #251a12 0%, #000 60%)',
        color: T.fg, fontFamily: T.ui,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{
          fontFamily: T.display, fontStyle: 'italic',
          fontSize: 42, letterSpacing: 0.5, marginBottom: 40, textAlign: 'center',
        }}>
          jellyfin
        </div>

        {step === 'server' ? (
          <form onSubmit={chooseServer}>
            <label style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim }}>
              Servidor
            </label>
            <input
              autoFocus
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://mi-servidor.local:8096"
              style={inputStyle}
            />
            <div style={{ fontSize: 12, color: T.dim, marginTop: 12, lineHeight: 1.5 }}>
              Introduce la URL pública de tu servidor Jellyfin. Este dato se
              guarda para la próxima vez que abras la app.
            </div>
            <button type="submit" style={primaryBtn} disabled={!serverUrl.trim()}>
              Conectar
            </button>
          </form>
        ) : (
          <form onSubmit={submitLogin}>
            <button
              type="button"
              onClick={() => setStep('server')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', color: T.dim,
                fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 20,
              }}
            >
              <Ic.Arrow size={12} /> Cambiar servidor
            </button>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim, marginBottom: 8 }}>
              {serverUrl}
            </div>

            <label style={labelStyle}>Usuario</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu usuario"
              autoComplete="username"
              style={inputStyle}
            />

            <label style={{ ...labelStyle, marginTop: 16 }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={inputStyle}
            />

            <button type="submit" style={primaryBtn} disabled={busy || !username || !password}>
              {busy ? 'Iniciando…' : 'Iniciar sesión'}
            </button>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 18, lineHeight: 1.6, textAlign: 'center' }}>
              Usa las credenciales del usuario que creaste en el wizard de Jellyfin.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim,
  display: 'block', marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 10, padding: '14px 16px',
  color: T.fg, fontFamily: T.ui, fontSize: 15, outline: 'none',
  transition: 'border-color .2s, background .2s',
};

const primaryBtn: React.CSSProperties = {
  width: '100%', marginTop: 26, padding: '13px 18px',
  background: '#fff', color: '#000',
  border: 'none', borderRadius: 999,
  fontFamily: 'inherit', fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
  cursor: 'pointer',
};
