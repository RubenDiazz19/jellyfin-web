import { useState } from 'react';

import globalize from 'lib/globalize';

import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { loginVM, type DiscoveredServer } from '../../../domain/viewModels/LoginViewModel';
import { useToast } from '../../components/toast/ToastProvider';
import { JellyfinBrandHeader } from './JellyfinBrandHeader';

// Vista de selección de servidores Jellyfin:
// - Cabecera oficial Jellyfin (icono + texto horizontal).
// - Círculos minimalistas y elegantes en escala monocroma pura, sin cambios de color.
// - Círculo (+) para añadir un nuevo servidor.

export function ServerSelectView() {
    const toast = useToast();
    const [manualUrl, setManualUrl] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    const servers = loginVM.servers.value;
    const checking = loginVM.checkingServers.value;
    // Filtramos estrictamente los servidores encendidos/disponibles (online === true).
    // Si un servidor está apagado (online === false), no aparecerá en pantalla.
    const availableServers = servers.filter((srv) => srv.online === true);

    const handleConnect = async (server: DiscoveredServer) => {
        setConnecting(true);
        const res = await loginVM.selectServer(server);
        setConnecting(false);
        if (!res.ok) {
            toast(res.message || globalize.translate('MessageInvalidServer'), 'warn');
        }
    };

    const handleAddManual = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = manualUrl.trim();
        if (!trimmed) return;
        setConnecting(true);
        const res = await loginVM.selectServer({ name: trimmed, url: trimmed });
        setConnecting(false);
        if (!res.ok) {
            toast(res.message || globalize.translate('MessageInvalidServer'), 'warn');
        } else {
            setManualUrl('');
            setShowAddForm(false);
        }
    };

    const handleRemove = (e: React.MouseEvent, url: string) => {
        e.stopPropagation();
        loginVM.removeServer(url);
        toast(globalize.translate('ItemRemoved'), 'info');
    };

    return (
        <div style={pageContainerStyle}>
            {/* Cabecera oficial Jellyfin */}
            <JellyfinBrandHeader />

            <h1 style={titleStyle}>{globalize.translate('SelectServer')}</h1>

            {/* Contenedor de círculos separados minimalistas */}
            <div style={circlesGridStyle}>
                {checking && availableServers.length === 0 ? (
                    [1, 2].map((i) => (
                        <div key={i} style={skeletonCircleStyle} className='jfp-skeleton' />
                    ))
                ) : (
                    availableServers.map((srv) => (
                        <ServerCircle
                            key={srv.url}
                            server={srv}
                            disabled={connecting}
                            onSelect={() => handleConnect(srv)}
                            onRemove={(e) => handleRemove(e, srv.url)}
                        />
                    ))
                )}

                {/* Círculo para añadir servidor (+) */}
                <AddServerCircle
                    active={showAddForm}
                    disabled={connecting}
                    onClick={() => setShowAddForm(!showAddForm)}
                />
            </div>

            {/* Si no hay servidores encendidos disponibles */}
            {!checking && availableServers.length === 0 && (
                <div style={noServersContainerStyle}>
                    <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)', marginBottom: 14 }}>
                        {globalize.translate('MessageNoServersAvailable')}
                    </div>
                    <button
                        type='button'
                        onClick={() => { void loginVM.loadServers(); }}
                        style={refreshBtnStyle}
                    >
                        <Ic.Refresh size={12} stroke='currentColor' />
                        <span>{globalize.translate('ButtonRefresh')}</span>
                    </button>
                </div>
            )}

            {/* Formulario para añadir servidor */}
            {showAddForm && (
                <div style={formWrapperStyle}>
                    <form onSubmit={handleAddManual} style={formStyle}>
                        <input
                            type='text'
                            autoFocus
                            value={manualUrl}
                            onChange={(e) => setManualUrl(e.target.value)}
                            placeholder='http://192.168.1.100:8096'
                            disabled={connecting}
                            style={inputStyle}
                        />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                type='submit'
                                disabled={connecting || !manualUrl.trim()}
                                style={connectBtnStyle}
                            >
                                {connecting ? (
                                    <span className='jfp-skeleton' style={{ width: 14, height: 14, borderRadius: 999 }} />
                                ) : (
                                    globalize.translate('ButtonConnect')
                                )}
                            </button>
                            <button
                                type='button'
                                onClick={() => setShowAddForm(false)}
                                style={cancelBtnStyle}
                            >
                                {globalize.translate('ButtonCancel')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function ServerCircle({
    server,
    disabled,
    onSelect,
    onRemove
}: {
    server: DiscoveredServer;
    disabled: boolean;
    onSelect: () => void;
    onRemove: (e: React.MouseEvent) => void;
}) {
    const [hovered, setHovered] = useState(false);
    const cleanUrl = server.url.replace(/^https?:\/\//, '');

    return (
        <div
            onClick={disabled ? undefined : onSelect}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
            style={serverItemStyle}
        >
            <div
                style={{
                    ...circleBaseStyle,
                    background: hovered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    borderColor: hovered ? 'rgba(255, 255, 255, 0.38)' : 'rgba(255, 255, 255, 0.12)',
                    cursor: disabled ? 'default' : 'pointer'
                }}
            >
                <Ic.Server
                    size={30}
                    stroke={hovered ? '#ffffff' : 'rgba(255, 255, 255, 0.75)'}
                    sw={1.3}
                />

                {/* Botón discreto para eliminar servidor guardado */}
                {hovered && (
                    <button
                        type='button'
                        onClick={onRemove}
                        title={globalize.translate('ButtonDeleteServer')}
                        aria-label={globalize.translate('ButtonDeleteServer')}
                        style={removePillStyle}
                    >
                        <Ic.Trash size={11} stroke='rgba(255, 255, 255, 0.8)' />
                    </button>
                )}
            </div>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
                <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: hovered ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                    maxWidth: 130,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: -0.2,
                    transition: 'color 0.2s ease'
                }}>
                    {server.name || 'Jellyfin'}
                </div>
                <div style={{
                    fontSize: 12,
                    color: 'rgba(255, 255, 255, 0.38)',
                    marginTop: 3,
                    maxWidth: 130,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: 0
                }}>
                    {cleanUrl}
                </div>
            </div>
        </div>
    );
}

function AddServerCircle({
    active,
    disabled,
    onClick
}: {
    active: boolean;
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
            style={serverItemStyle}
        >
            <div
                style={{
                    ...circleBaseStyle,
                    borderColor: active || hovered ? 'rgba(255, 255, 255, 0.38)' : 'rgba(255, 255, 255, 0.12)',
                    background: hovered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: disabled ? 'default' : 'pointer'
                }}
            >
                <Ic.Plus
                    size={22}
                    stroke={active || hovered ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'}
                    sw={1.3}
                />
            </div>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
                <div style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: hovered ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                    letterSpacing: -0.2,
                    transition: 'color 0.2s ease'
                }}>
                    {globalize.translate('ButtonAddServer')}
                </div>
            </div>
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
    margin: '0 0 40px',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center'
};

const circlesGridStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 32,
    maxWidth: 800,
    margin: '0 auto',
    animation: 'jfp-fade-in 0.3s ease'
};

const serverItemStyle: React.CSSProperties = {
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

const removePillStyle: React.CSSProperties = {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0
};

const formWrapperStyle: React.CSSProperties = {
    marginTop: 36,
    width: '100%',
    maxWidth: 400,
    animation: 'jfp-fade-in 0.25s ease'
};

const formStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 12
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

const connectBtnStyle: React.CSSProperties = {
    flex: 1,
    padding: '11px 18px',
    background: '#ffffff',
    color: '#000000',
    border: 'none',
    borderRadius: 999,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const cancelBtnStyle: React.CSSProperties = {
    padding: '11px 18px',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    fontFamily: 'inherit',
    fontSize: 13,
    cursor: 'pointer'
};

const skeletonCircleStyle: React.CSSProperties = {
    width: 104,
    height: 104,
    borderRadius: '50%'
};

const noServersContainerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginTop: 28,
    animation: 'jfp-fade-in 0.3s ease'
};

const refreshBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    padding: '7px 16px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'inherit',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all .2s'
};
