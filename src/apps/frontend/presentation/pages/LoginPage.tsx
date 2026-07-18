import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { loginVM } from '../../domain/viewModels/LoginViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { useToast } from '../components/toast/ToastProvider';

// Login en dos pasos: servidor y luego usuario + contraseña. La lógica vive
// en LoginViewModel; esta View solo pinta signals y muestra el resultado.

export function LoginPage() {
    useViewModel(loginVM);
    const toast = useToast();

    const step = loginVM.step.value;
    const serverUrl = loginVM.serverUrl.value;
    const username = loginVM.username.value;
    const password = loginVM.password.value;
    const busy = loginVM.busy.value;

    const chooseServer = (e: React.FormEvent) => {
        e.preventDefault();
        loginVM.chooseServer();
    };

    const submitLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await loginVM.submitLogin();
        toast(result.message, result.ok ? 'success' : 'warn');
    };

    return (
        <div
            style={{
                minHeight: '100vh', width: '100%',
                background: 'radial-gradient(ellipse at 30% 20%, #251a12 0%, #000 60%)',
                color: T.fg, fontFamily: T.ui,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24
            }}
        >
            <div style={{ width: '100%', maxWidth: 380 }}>
                <div style={{
                    fontFamily: T.display, fontStyle: 'italic',
                    fontSize: 42, letterSpacing: 0.5, marginBottom: 40, textAlign: 'center'
                }}>
                    jellyfin
                </div>

                {step === 'server' ? (
                    <form onSubmit={chooseServer}>
                        <label htmlFor='jfp-login-server' style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim }}>
                            Servidor
                        </label>
                        <input
                            id='jfp-login-server'
                            autoFocus
                            value={serverUrl}
                            onChange={(e) => loginVM.setServerUrl(e.target.value)}
                            placeholder='http://mi-servidor.local:8096'
                            style={inputStyle}
                        />
                        <div style={{ fontSize: 12, color: T.dim, marginTop: 12, lineHeight: 1.5 }}>
                            Introduce la URL pública de tu servidor Jellyfin. Este dato se
                            guarda para la próxima vez que abras la app.
                        </div>
                        <button type='submit' style={primaryBtn} disabled={!serverUrl.trim()}>
                            Conectar
                        </button>
                    </form>
                ) : (
                    <form onSubmit={submitLogin}>
                        <button
                            type='button'
                            onClick={loginVM.backToServer}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: 'none', border: 'none', color: T.dim,
                                fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 20
                            }}
                        >
                            <Ic.Arrow size={12} /> Cambiar servidor
                        </button>
                        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim, marginBottom: 8 }}>
                            {serverUrl}
                        </div>

                        <label htmlFor='jfp-login-user' style={labelStyle}>Usuario</label>
                        <input
                            id='jfp-login-user'
                            autoFocus
                            value={username}
                            onChange={(e) => loginVM.setUsername(e.target.value)}
                            placeholder='tu usuario'
                            autoComplete='username'
                            style={inputStyle}
                        />

                        <label htmlFor='jfp-login-pass' style={{ ...labelStyle, marginTop: 16 }}>Contraseña</label>
                        <input
                            id='jfp-login-pass'
                            type='password'
                            value={password}
                            onChange={(e) => loginVM.setPassword(e.target.value)}
                            placeholder='••••••••'
                            autoComplete='current-password'
                            style={inputStyle}
                        />

                        <button type='submit' style={primaryBtn} disabled={busy || !username || !password}>
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
    display: 'block', marginBottom: 8
};

const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 10, padding: '14px 16px',
    color: T.fg, fontFamily: T.ui, fontSize: 15, outline: 'none',
    transition: 'border-color .2s, background .2s'
};

const primaryBtn: React.CSSProperties = {
    width: '100%', marginTop: 26, padding: '13px 18px',
    background: '#fff', color: '#000',
    border: 'none', borderRadius: 999,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
    cursor: 'pointer'
};
