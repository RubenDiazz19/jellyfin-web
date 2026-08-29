import { useEffect } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { loginVM } from '../../domain/viewModels/LoginViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { useToast } from '../components/toast/ToastProvider';

// Login en dos pasos: servidor y luego usuario + contraseña, o Quick Connect si
// el servidor lo ofrece. La lógica vive en LoginViewModel; esta View solo pinta
// signals y muestra el resultado.

export function LoginPage() {
    useViewModel(loginVM);
    const toast = useToast();

    const step = loginVM.step.value;
    const serverUrl = loginVM.serverUrl.value;
    const username = loginVM.username.value;
    const password = loginVM.password.value;
    const busy = loginVM.busy.value;
    const quickCode = loginVM.quickConnectCode.value;

    // Al llegar al paso de credenciales se pregunta si este servidor ofrece
    // Quick Connect. Al salir del login se corta cualquier espera viva.
    useEffect(() => {
        if (step === 'login') void loginVM.checkQuickConnect();
    }, [step, serverUrl]);
    useEffect(() => () => { loginVM.cancelQuickConnect(); }, []);

    const chooseServer = (e: React.FormEvent) => {
        e.preventDefault();
        loginVM.chooseServer();
    };

    const submitLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await loginVM.submitLogin();
        toast(result.message, result.ok ? 'success' : 'warn');
    };

    const startQuickConnect = async () => {
        const result = await loginVM.startQuickConnect();
        // null = lo ha cancelado el usuario: no hay nada que contarle.
        if (result) toast(result.message, result.ok ? 'success' : 'warn');
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
                    fontFamily: T.display,
                    fontSize: 42, letterSpacing: 0.5, marginBottom: 40, textAlign: 'center'
                }}>
                    jellyfin
                </div>

                {step === 'server' ? (
                    <form onSubmit={chooseServer}>
                        <label htmlFor='jfp-login-server' style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim }}>
                            {globalize.translate('TabServer')}
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
                            {globalize.translate('LabelServerUrlHelp')}
                        </div>
                        <button type='submit' style={primaryBtn} disabled={!serverUrl.trim()}>
                            {globalize.translate('ButtonConnect')}
                        </button>
                    </form>
                ) : quickCode ? (
                    <QuickConnectCode code={quickCode} onCancel={loginVM.cancelQuickConnect} />
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
                            <Ic.Arrow size={12} /> {globalize.translate('ButtonChangeServer')}
                        </button>
                        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim, marginBottom: 8 }}>
                            {serverUrl}
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

                        <button type='submit' style={primaryBtn} disabled={busy || !username || !password}>
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

                        <div style={{ fontSize: 11, color: T.dim, marginTop: 18, lineHeight: 1.6, textAlign: 'center' }}>
                            {globalize.translate('MessageUseJellyfinCredentials')}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

/**
 * El código a aprobar, mientras se espera. Ocupa el sitio del formulario en vez
 * de acompañarlo: mientras el código está vivo no hay nada más que hacer aquí,
 * y las seis cifras son lo único que hay que leer.
 */
function QuickConnectCode({ code, onCancel }: { code: string; onCancel: () => void }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: T.dim }}>
                {globalize.translate('QuickConnect')}
            </div>
            <div style={{
                fontFamily: T.display, fontSize: 46, letterSpacing: 10,
                margin: '22px 0 6px', paddingLeft: 10
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

/** Separador con la conjunción, entre las dos formas de entrar. */
function Divider() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '22px 0 4px', fontSize: 11, color: T.dim,
            letterSpacing: 2, textTransform: 'uppercase'
        }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            {globalize.translate('LabelOr')}
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
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

// La otra vía de entrada, en segundo plano: contorno en vez de relleno, para
// que la acción principal siga siendo una sola.
const secondaryBtn: React.CSSProperties = {
    ...primaryBtn,
    marginTop: 14,
    background: 'transparent', color: T.fg,
    border: '1px solid rgba(255,255,255,0.22)'
};
