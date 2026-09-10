import { useEffect } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { loginVM } from '../../domain/viewModels/LoginViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { useToast } from '../components/toast/ToastProvider';
import { ServerSelectView } from './auth/ServerSelectView';
import { UserSelectView } from './auth/UserSelectView';
import { JellyfinBrandHeader } from './auth/JellyfinBrandHeader';

// Flujo de login y conexión:
// - Servidor: selección de servidores disponibles o añadir manualmente.
// - Usuarios: cuadrícula de perfiles estilo Netflix/Jellyfin o prompt de clave.
// - Manual: formulario tradicional de usuario + contraseña.
// - Quick Connect: código aprobado desde otra sesión.

export function LoginPage() {
    useViewModel(loginVM);
    const toast = useToast();

    const step = loginVM.step.value;
    const serverUrl = loginVM.serverUrl.value;
    const serverName = loginVM.serverName.value || serverUrl;
    const username = loginVM.username.value;
    const password = loginVM.password.value;
    const busy = loginVM.busy.value;
    const quickCode = loginVM.quickConnectCode.value;
    const hasPublicUsers = loginVM.publicUsers.value.length > 0;

    useEffect(() => {
        loginVM.init();
    }, []);

    // Al estar en un paso de autenticación comprobamos si el servidor ofrece Quick Connect
    useEffect(() => {
        if (step !== 'server' && serverUrl) void loginVM.checkQuickConnect();
    }, [step, serverUrl]);

    useEffect(() => () => { loginVM.cancelQuickConnect(); }, []);

    const submitLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await loginVM.submitLogin();
        toast(result.message, result.ok ? 'success' : 'warn');
    };

    const startQuickConnect = async () => {
        const result = await loginVM.startQuickConnect();
        if (result) toast(result.message, result.ok ? 'success' : 'warn');
    };

    // Pantalla 1: Selección de servidores
    if (step === 'server') {
        return <ServerSelectView />;
    }

    // Pantalla 2: Cuadrícula de perfiles / prompt de contraseña de usuario
    if ((step === 'users' || step === 'password') && !quickCode) {
        return <UserSelectView />;
    }

    // Código de Quick Connect
    if (quickCode) {
        return (
            <div style={fullScreenCenterStyle}>
                <div style={{ width: '100%', maxWidth: 380 }}>
                    <QuickConnectCode code={quickCode} onCancel={loginVM.cancelQuickConnect} />
                </div>
            </div>
        );
    }

    // Formulario de login manual (paso 'login' o 'manual')
    return (
        <div style={fullScreenCenterStyle}>
            <div style={{ width: '100%', maxWidth: 380, animation: 'jfp-fade-in 0.3s ease' }}>
                <JellyfinBrandHeader />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <button
                        type='button'
                        onClick={loginVM.backToServer}
                        style={serverPillBtnStyle}
                        title={globalize.translate('ButtonChangeServer')}
                    >
                        <Ic.Server size={14} stroke='rgba(255, 255, 255, 0.6)' />
                        <span>{serverName}</span>
                    </button>
                </div>

                <form onSubmit={submitLogin}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        {hasPublicUsers ? (
                            <button
                                type='button'
                                onClick={loginVM.backToUsers}
                                style={textLinkBtnStyle}
                            >
                                <Ic.Arrow size={12} dir='left' />
                                {globalize.translate('ButtonChangeProfile')}
                            </button>
                        ) : (
                            <button
                                type='button'
                                onClick={loginVM.backToServer}
                                style={textLinkBtnStyle}
                            >
                                <Ic.Arrow size={12} dir='left' />
                                {globalize.translate('ButtonChangeServer')}
                            </button>
                        )}
                    </div>

                    <label htmlFor='jfp-login-user' style={labelStyle}>{globalize.translate('LabelUsername')}</label>
                    <input
                        id='jfp-login-user'
                        autoFocus
                        value={username}
                        onChange={(e) => loginVM.setUsername(e.target.value)}
                        placeholder={globalize.translate('LabelUsername')}
                        autoComplete='username'
                        style={inputStyle}
                    />

                    <label htmlFor='jfp-login-pass' style={{ ...labelStyle, marginTop: 16 }}>{globalize.translate('LabelPassword')}</label>
                    <input
                        id='jfp-login-pass'
                        type='password'
                        value={password}
                        onChange={(e) => loginVM.setPassword(e.target.value)}
                        placeholder='••••••••'
                        autoComplete='current-password'
                        style={inputStyle}
                    />

                    <button type='submit' style={primaryBtn} disabled={busy || !username}>
                        {globalize.translate(busy ? 'SigningIn' : 'ButtonSignIn')}
                    </button>

                    {loginVM.quickConnectAvailable.value && (
                        <>
                            <Divider />
                            <button
                                type='button'
                                onClick={startQuickConnect}
                                disabled={busy}
                                style={secondaryBtn}
                            >
                                {globalize.translate('QuickConnect')}
                            </button>
                        </>
                    )}

                    <div style={{ fontSize: 11, color: T.dim, marginTop: 20, lineHeight: 1.6, textAlign: 'center' }}>
                        {globalize.translate('MessageUseJellyfinCredentials')}
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * El código a aprobar, mientras se espera.
 */
function QuickConnectCode({ code, onCancel }: { code: string; onCancel: () => void }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim }}>
                {globalize.translate('QuickConnect')}
            </div>
            <div style={{
                fontFamily: T.ui, fontSize: 46, letterSpacing: 10,
                margin: '22px 0 6px', paddingLeft: 10, color: '#fff'
            }}>
                {code}
            </div>
            <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.6, marginTop: 14 }}>
                {globalize.translate('QuickConnectEnterCodeElsewhere')}
            </div>
            <div style={{
                fontSize: 12, color: T.dim, marginTop: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
                <span className='jfp-skeleton' style={{ width: 8, height: 8, borderRadius: 999 }} />
                {globalize.translate('QuickConnectWaiting')}
            </div>
            <button type='button' onClick={onCancel} style={{ ...secondaryBtn, marginTop: 26 }}>
                {globalize.translate('ButtonCancel')}
            </button>
        </div>
    );
}

function Divider() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '22px 0 4px', fontSize: 11, color: T.dim,
            letterSpacing: 2, textTransform: 'uppercase'
        }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            {globalize.translate('LabelOr')}
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>
    );
}

const fullScreenCenterStyle: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#000000',
    color: T.fg,
    fontFamily: T.ui,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    boxSizing: 'border-box'
};

const textLinkBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    color: T.dim,
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit'
};

const labelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: T.dim,
    display: 'block',
    marginBottom: 8
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 10,
    padding: '14px 16px',
    color: T.fg,
    fontFamily: T.ui,
    fontSize: 15,
    outline: 'none',
    transition: 'border-color .2s, background .2s'
};

const primaryBtn: React.CSSProperties = {
    width: '100%',
    marginTop: 24,
    padding: '13px 18px',
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: 999,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.3,
    cursor: 'pointer'
};

const secondaryBtn: React.CSSProperties = {
    ...primaryBtn,
    marginTop: 14,
    background: 'transparent',
    color: T.fg,
    border: '1px solid rgba(255,255,255,0.22)'
};

const serverPillBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    padding: '5px 14px',
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all .2s'
};
