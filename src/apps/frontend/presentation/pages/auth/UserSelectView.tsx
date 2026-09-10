import { useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { loginVM, type PublicUser } from '../../../domain/viewModels/LoginViewModel';
import { useToast } from '../../components/toast/ToastProvider';
import { JellyfinBrandHeader } from './JellyfinBrandHeader';

// Pantalla de selección de usuarios / perfiles estilo Netflix / Jellyfin:
// - Cabecera oficial Jellyfin (icono + texto horizontal).
// - Título "¿Quién está viendo?".
// - Cuadrícula de perfiles circulares minimalistas en escala monocroma pura.

export function UserSelectView() {
    const toast = useToast();
    const step = loginVM.step.value;
    const users = loginVM.publicUsers.value;
    const loading = loginVM.loadingUsers.value;
    const selectedUser = loginVM.selectedUser.value;
    const serverUrl = loginVM.serverUrl.value;
    const serverName = loginVM.serverName.value || serverUrl;
    const busy = loginVM.busy.value;
    const password = loginVM.password.value;

    const handleProfileClick = async (user: PublicUser) => {
        const res = await loginVM.selectUser(user);
        if (res) {
            toast(res.message, res.ok ? 'success' : 'warn');
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await loginVM.submitLogin();
        toast(res.message, res.ok ? 'success' : 'warn');
    };

    return (
        <div style={pageContainerStyle}>
            {/* Cabecera oficial Jellyfin */}
            <JellyfinBrandHeader />

            {step === 'password' && selectedUser ? (
                <h1 style={titleStyle}>{selectedUser.name}</h1>
            ) : (
                <h1 style={titleStyle}>{globalize.translate('HeaderWhosWatching')}</h1>
            )}

            {/* Si un usuario con contraseña ha sido seleccionado: prompt de clave */}
            {step === 'password' && selectedUser ? (
                <div style={passwordCardWrapperStyle}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ display: 'inline-block', position: 'relative' }}>
                            <ProfileAvatarCircle
                                user={selectedUser}
                                size={96}
                                avatarUrl={loginVM.getUserAvatarUrl(selectedUser)}
                            />
                            <div style={lockBadgeOverlayStyle}>
                                <Ic.Lock size={12} stroke='#fff' />
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.5)', marginTop: 10 }}>
                            {globalize.translate('LabelEnterPasswordFor', selectedUser.name)}
                        </div>
                    </div>

                    <form onSubmit={handlePasswordSubmit}>
                        <label htmlFor='jfp-user-pwd' style={labelStyle}>
                            {globalize.translate('LabelPassword')}
                        </label>
                        <input
                            id='jfp-user-pwd'
                            type='password'
                            autoFocus
                            value={password}
                            onChange={(e) => loginVM.setPassword(e.target.value)}
                            placeholder='••••••••'
                            style={inputStyle}
                        />

                        <button
                            type='submit'
                            disabled={busy || !password}
                            style={primaryBtnStyle}
                        >
                            {globalize.translate(busy ? 'SigningIn' : 'ButtonSignIn')}
                        </button>

                        <button
                            type='button'
                            onClick={loginVM.backToUsers}
                            style={secondaryBtnStyle}
                        >
                            {globalize.translate('ButtonChangeProfile')}
                        </button>
                    </form>
                </div>
            ) : (
                /* Cuadrícula de perfiles circulares */
                <div style={profilesSectionStyle}>
                    {loading ? (
                        <div style={circlesGridStyle}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} style={skeletonCircleStyle} className='jfp-skeleton' />
                            ))}
                        </div>
                    ) : users.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 24 }}>
                            <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 20 }}>
                                {globalize.translate('LabelNoUsersFound')}
                            </div>
                            <button
                                type='button'
                                onClick={loginVM.goToManualLogin}
                                style={outlineActionBtnStyle}
                            >
                                <Ic.User size={15} stroke='currentColor' />
                                {globalize.translate('ButtonManualLogin')}
                            </button>
                        </div>
                    ) : (
                        <div style={circlesGridStyle}>
                            {users.map((u) => (
                                <ProfileCircleItem
                                    key={u.id}
                                    user={u}
                                    avatarUrl={loginVM.getUserAvatarUrl(u)}
                                    disabled={busy}
                                    onClick={() => handleProfileClick(u)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Acciones de pie: login manual y Quick Connect */}
                    <div style={footerActionsStyle}>
                        <div style={{ display: 'flex', gap: 14 }}>
                            <button
                                type='button'
                                onClick={loginVM.goToManualLogin}
                                style={ghostBtnStyle}
                            >
                                <Ic.User size={14} stroke='rgba(255, 255, 255, 0.6)' />
                                <span>{globalize.translate('ButtonManualLogin')}</span>
                            </button>

                            {loginVM.quickConnectAvailable.value && (
                                <button
                                    type='button'
                                    onClick={loginVM.startQuickConnect}
                                    style={ghostBtnStyle}
                                >
                                    <Ic.Key size={14} stroke='rgba(255, 255, 255, 0.6)' />
                                    <span>{globalize.translate('QuickConnect')}</span>
                                </button>
                            )}
                        </div>
                        <div style={{ marginTop: 14 }}>
                            <button
                                type='button'
                                onClick={loginVM.backToServer}
                                style={ghostBtnStyle}
                                title={globalize.translate('ButtonChangeServer')}
                            >
                                <Ic.Server size={14} stroke='rgba(255, 255, 255, 0.6)' />
                                <span>{serverName}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProfileCircleItem({
    user,
    avatarUrl,
    disabled,
    onClick
}: {
    user: PublicUser;
    avatarUrl: string;
    disabled: boolean;
    onClick: () => void;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onClick={disabled ? undefined : onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
            style={profileItemStyle}
        >
            <div
                style={{
                    ...circleBaseStyle,
                    borderColor: hovered ? 'rgba(255, 255, 255, 0.38)' : 'rgba(255, 255, 255, 0.12)',
                    background: hovered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: disabled ? 'default' : 'pointer'
                }}
            >
                <ProfileAvatarCircle user={user} size={100} avatarUrl={avatarUrl} />
                {user.hasPassword && (
                    <div style={lockBadgeCircleStyle} title={globalize.translate('LabelPassword')}>
                        <Ic.Lock size={10} stroke='rgba(255, 255, 255, 0.7)' />
                    </div>
                )}
            </div>

            <span
                style={{
                    marginTop: 14,
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: -0.2,
                    color: hovered ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                    transition: 'color 0.2s ease',
                    maxWidth: 130,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}
            >
                {user.name}
            </span>
        </div>
    );
}

function ProfileAvatarCircle({
    user,
    size,
    avatarUrl
}: {
    user: PublicUser;
    size: number;
    avatarUrl: string;
}) {
    const [imgFailed, setImgFailed] = useState(false);

    if (avatarUrl && !imgFailed) {
        return (
            <img
                src={avatarUrl}
                alt={user.name}
                onError={() => setImgFailed(true)}
                style={{
                    width: size,
                    height: size,
                    objectFit: 'cover',
                    borderRadius: '50%',
                    display: 'block'
                }}
            />
        );
    }

    const initial = (user.name || '?').charAt(0).toUpperCase();
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: size * 0.38,
                fontWeight: 500,
                fontFamily: T.ui
            }}
        >
            {initial}
        </div>
    );
}

const pageContainerStyle: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#000000',
    color: T.fg,
    fontFamily: T.ui,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    boxSizing: 'border-box'
};

const titleStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 400,
    letterSpacing: -0.3,
    margin: 0,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center'
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

const profilesSectionStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 800,
    animation: 'jfp-fade-in 0.3s ease'
};

const passwordCardWrapperStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 340,
    animation: 'jfp-fade-in 0.25s ease'
};

const circlesGridStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
    margin: '16px 0'
};

const profileItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    outline: 'none',
    userSelect: 'none'
};

const circleBaseStyle: React.CSSProperties = {
    width: 104,
    height: 104,
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.22s ease, background 0.22s ease'
};

const lockBadgeCircleStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const lockBadgeOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const skeletonCircleStyle: React.CSSProperties = {
    width: 104,
    height: 104,
    borderRadius: '50%'
};

const footerActionsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36
};

const ghostBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    padding: '8px 16px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'inherit',
    fontSize: 12,
    letterSpacing: 0.2,
    cursor: 'pointer',
    transition: 'all .2s'
};

const outlineActionBtnStyle: React.CSSProperties = {
    ...ghostBtnStyle,
    color: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: '10px 20px',
    fontSize: 13
};

const labelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.5)',
    display: 'block',
    marginBottom: 8
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 8,
    padding: '12px 14px',
    color: T.fg,
    fontFamily: T.ui,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color .2s'
};

const primaryBtnStyle: React.CSSProperties = {
    width: '100%',
    marginTop: 20,
    padding: '12px 18px',
    background: '#ffffff',
    color: '#000000',
    border: 'none',
    borderRadius: 999,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
};

const secondaryBtnStyle: React.CSSProperties = {
    ...primaryBtnStyle,
    marginTop: 10,
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.14)'
};
