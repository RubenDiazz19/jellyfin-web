import { useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { loginVM, type PublicUser } from '../../../domain/viewModels/LoginViewModel';
import { useToast } from '../../components/toast/ToastProvider';
import { JellyfinBrandHeader } from './JellyfinBrandHeader';
import {
    circleBaseStyle, circlesGridStyle, ghostBtnStyle, inputStyle, labelStyle, listContainerStyle,
    pageContainerStyle, primaryBtnStyle, profileItemStyle, secondaryBtnStyle, skeletonCircleStyle, titleStyle
} from './styles';

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
                <div style={listContainerStyle}>
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
                                <Ic.User size={14} stroke='currentColor' />
                                <span>{globalize.translate('ButtonManualLogin')}</span>
                            </button>

                            {loginVM.quickConnectAvailable.value && (
                                <button
                                    type='button'
                                    onClick={loginVM.startQuickConnect}
                                    style={ghostBtnStyle}
                                >
                                    <Ic.Key size={14} stroke='currentColor' />
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
                                <Ic.Server size={14} stroke='currentColor' />
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

const footerActionsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36
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

const outlineActionBtnStyle: React.CSSProperties = {
    ...ghostBtnStyle,
    color: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: '10px 20px',
    fontSize: 13
};

const passwordCardWrapperStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 340,
    animation: 'jfp-fade-in 0.25s ease'
};
