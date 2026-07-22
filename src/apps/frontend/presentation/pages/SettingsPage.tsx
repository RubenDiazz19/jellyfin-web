import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { LibraryCardMenu } from '../components/admin/LibraryCardMenu';
import { useSession } from '../../domain/bridge/useSession';
import { useToast } from '../components/toast/ToastProvider';
import {
    getCurrentUser, updateUserConfig, changePassword,
    avatarUrl, uploadAvatar, deleteAvatar,
    getUserViews, getUsers, getSystemInfo, refreshLibrary,
    getMaxStreamingBitrate, setMaxStreamingBitrate,
    type CurrentUser, type UserConfig, type SubtitleMode,
    type UserView, type UserListEntry, type SystemInfo
} from '../../domain/api';
import type { Navigate } from '../../app/router';

// Ajustes de usuario contra la API real de Jellyfin: la idea es no tener que
// abrir el web nativo para las preferencias del día a día. Toda la
// administración se centraliza aquí; las herramientas profundas de servidor
// (carpetas, plugins, alta de usuarios) enlazan al dashboard embebido de la
// propia app (#/dashboard).

type SectionId = 'perfil' | 'reproduccion' | 'subtitulos' | 'bibliotecas' | 'servidor' | 'usuarios';

type GoDashboard = (sub?: string) => void;

const LANGUAGES: [string, string][] = [
    ['', 'Cualquiera'],
    ['spa', 'Español'],
    ['eng', 'Inglés'],
    ['jpn', 'Japonés'],
    ['fre', 'Francés'],
    ['ger', 'Alemán'],
    ['ita', 'Italiano'],
    ['por', 'Portugués'],
    ['rus', 'Ruso'],
    ['kor', 'Coreano'],
    ['chi', 'Chino'],
    ['ara', 'Árabe']
];

const SUBTITLE_MODES: [SubtitleMode, string, string][] = [
    ['Default', 'Por defecto', 'Usa la pista marcada como predeterminada en el archivo'],
    ['Smart', 'Inteligente', 'Solo cuando el audio no está en tu idioma preferido'],
    ['OnlyForced', 'Solo forzados', 'Únicamente subtítulos forzados (carteles, idiomas extranjeros)'],
    ['Always', 'Siempre', 'Activa los subtítulos en toda reproducción'],
    ['None', 'Nunca', 'No activa subtítulos automáticamente']
];

const BITRATES: [number, string][] = [
    [4_000_000, '4 Mbps — SD'],
    [8_000_000, '8 Mbps — HD ajustado'],
    [10_000_000, '10 Mbps — HD'],
    [15_000_000, '15 Mbps — Full HD'],
    [20_000_000, '20 Mbps — Full HD alto (por defecto)'],
    [40_000_000, '40 Mbps — 4K'],
    [60_000_000, '60 Mbps — 4K alto'],
    [120_000_000, '120 Mbps — Sin restricción práctica']
];

export function SettingsPage({ navigate, initial = 'perfil' }: { navigate: Navigate; initial?: SectionId }) {
    const { session, logout } = useSession();
    const toast = useToast();
    const isReal = !!session?.accessToken;
    const [section, setSection] = useState<SectionId>(initial);
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    // useNavigate del router raíz: el dashboard embebido (apps/dashboard) vive
    // en la misma SPA bajo /dashboard. window.location.hash NO basta — el
    // data-router de react-router no reevalúa las rutas con un cambio de hash
    // manual, así que hay que navegar por aquí.
    const rrNavigate = useNavigate();
    const goDashboard: GoDashboard = (sub = '') => rrNavigate(`/dashboard${sub}`);

    useEffect(() => {
        if (!isReal) return;
        getCurrentUser()
            .then(setUser)
            .catch((e) => setLoadError((e as Error).message));
    }, [isReal]);

    // Parche optimista de la configuración del usuario: pinta el cambio al
    // instante y revierte si el server lo rechaza.
    const patchConfig = async (patch: Partial<UserConfig>) => {
        if (!user) return;
        const prev = user.config;
        setUser({ ...user, config: { ...prev, ...patch } });
        try {
            await updateUserConfig(patch);
            toast('Preferencia guardada', 'success');
        } catch (e) {
            setUser({ ...user, config: prev });
            toast((e as Error).message, 'warn');
        }
    };

    const sections: { id: SectionId; label: string }[] = [
        { id: 'perfil', label: 'Perfil' },
        { id: 'reproduccion', label: 'Reproducción' },
        { id: 'subtitulos', label: 'Subtítulos' },
        { id: 'bibliotecas', label: 'Bibliotecas' },
        { id: 'servidor', label: 'Servidor' },
        ...(user?.isAdmin ? [{ id: 'usuarios' as SectionId, label: 'Usuarios' }] : [])
    ];

    return (
        <>
            <Nav navigate={navigate} breadcrumb={[{ label: 'Inicio', to: { page: 'home' } }, { label: 'Ajustes' }]} />
            <section style={{
                background: '#000', color: '#fff', minHeight: '100vh',
                padding: '120px 56px 96px', fontFamily: T.ui
            }}>
                <h1 style={{
                    fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                    fontSize: 52, margin: 0, letterSpacing: -0.5, marginBottom: 44
                }}>
                    Ajustes
                </h1>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)',
                    gap: 56, alignItems: 'start', maxWidth: 1100
                }}>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {sections.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSection(item.id)}
                                style={{
                                    textAlign: 'left', padding: '10px 14px',
                                    background: section === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                                    color: section === item.id ? T.fg : T.dim,
                                    border: 'none', borderRadius: 8,
                                    fontFamily: T.ui, fontSize: 14, cursor: 'pointer',
                                    transition: 'background .15s, color .15s'
                                }}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    <div>
                        {!isReal ? (
                            <div style={{ color: T.dim, fontSize: 14 }}>
                                Inicia sesión en un servidor Jellyfin para gestionar tus ajustes.
                            </div>
                        ) : loadError ? (
                            <div style={{ color: '#ff6b6b', fontSize: 14 }}>{loadError}</div>
                        ) : !user ? (
                            <div style={{
                                color: T.dim, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase'
                            }}>
                                Cargando…
                            </div>
                        ) : (
                            <>
                                {section === 'perfil' && (
                                    <ProfileSection
                                        user={user}
                                        serverUrl={session?.serverUrl ?? ''}
                                        onAvatarChange={() => {
                                            getCurrentUser().then(setUser).catch(() => {});
                                        }}
                                        logout={logout}
                                    />
                                )}
                                {section === 'reproduccion' && (
                                    <PlaybackSection config={user.config} patch={patchConfig} />
                                )}
                                {section === 'subtitulos' && (
                                    <SubtitleSection config={user.config} patch={patchConfig} />
                                )}
                                {section === 'bibliotecas' && (
                                    <LibrariesSection isAdmin={user.isAdmin} goDashboard={goDashboard} />
                                )}
                                {section === 'servidor' && (
                                    <ServerSection isAdmin={user.isAdmin} goDashboard={goDashboard} />
                                )}
                                {section === 'usuarios' && user.isAdmin && (
                                    <UsersSection goDashboard={goDashboard} />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}

// ── Perfil ──────────────────────────────────────────────────────────────────

function ProfileSection({
    user, serverUrl, onAvatarChange, logout
}: {
    user: CurrentUser; serverUrl: string; onAvatarChange: () => void; logout: () => void;
}) {
    const toast = useToast();
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [pwCurrent, setPwCurrent] = useState('');
    const [pwNew, setPwNew] = useState('');
    const [pwRepeat, setPwRepeat] = useState('');
    const [pwBusy, setPwBusy] = useState(false);

    const onUpload = async (file: File) => {
        setBusy(true);
        try {
            await uploadAvatar(file);
            toast('Avatar actualizado', 'success');
            onAvatarChange();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    };

    const onDeleteAvatar = async () => {
        setBusy(true);
        try {
            await deleteAvatar();
            toast('Avatar eliminado', 'success');
            onAvatarChange();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    };

    const onChangePassword = async () => {
        if (!pwNew) return toast('Escribe la nueva contraseña', 'warn');
        if (pwNew !== pwRepeat) return toast('Las contraseñas no coinciden', 'warn');
        setPwBusy(true);
        try {
            await changePassword(pwCurrent, pwNew);
            toast('Contraseña cambiada', 'success');
            setPwCurrent(''); setPwNew(''); setPwRepeat('');
        } catch (e) {
            toast(`No se pudo cambiar: ${(e as Error).message}`, 'warn');
        } finally {
            setPwBusy(false);
        }
    };

    return (
        <div>
            <SectionTitle>Perfil</SectionTitle>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 36 }}>
                {user.avatarTag ? (
                    <img
                        src={avatarUrl(user.avatarTag)}
                        alt={user.name}
                        style={{
                            width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}
                    />
                ) : (
                    <div style={{
                        width: 88, height: 88, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#d9a566,#3a1f10)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 34, fontWeight: 600
                    }}>
                        {user.name.slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                    <input
                        ref={fileRef} type='file' accept='image/*' style={{ display: 'none' }}
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onUpload(f);
                            e.target.value = '';
                        }}
                    />
                    <button style={btnSecondary} disabled={busy} onClick={() => fileRef.current?.click()}>
                        Cambiar foto
                    </button>
                    {user.avatarTag && (
                        <button style={btnDanger} disabled={busy} onClick={onDeleteAvatar}>
                            Quitar foto
                        </button>
                    )}
                </div>
            </div>

            <InfoRow label='Usuario' value={user.name} />
            <InfoRow label='Servidor' value={serverUrl} />
            <InfoRow
                label='Último acceso'
                value={user.lastLogin ? new Date(user.lastLogin).toLocaleString('es-ES') : '—'}
            />
            <InfoRow label='Rol' value={user.isAdmin ? 'Administrador' : 'Usuario'} />

            <SectionTitle style={{ marginTop: 44 }}>Cambiar contraseña</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
                {user.hasPassword && (
                    <input
                        type='password' placeholder='Contraseña actual' value={pwCurrent}
                        onChange={(e) => setPwCurrent(e.target.value)} style={inputStyle}
                        autoComplete='current-password'
                    />
                )}
                <input
                    type='password' placeholder='Nueva contraseña' value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)} style={inputStyle}
                    autoComplete='new-password'
                />
                <input
                    type='password' placeholder='Repite la nueva contraseña' value={pwRepeat}
                    onChange={(e) => setPwRepeat(e.target.value)} style={inputStyle}
                    autoComplete='new-password'
                />
                <div style={{ display: 'flex', gap: 12 }}>
                    <button style={btnSecondary} disabled={pwBusy} onClick={onChangePassword}>
                        {pwBusy ? 'Cambiando…' : 'Cambiar contraseña'}
                    </button>
                </div>
            </div>

            <div style={{ marginTop: 44 }}>
                <button onClick={logout} style={btnDanger}>Cerrar sesión</button>
            </div>
        </div>
    );
}

// ── Reproducción ────────────────────────────────────────────────────────────

function PlaybackSection({
    config, patch
}: {
    config: UserConfig; patch: (p: Partial<UserConfig>) => void;
}) {
    const toast = useToast();
    const [bitrate, setBitrate] = useState(getMaxStreamingBitrate());

    return (
        <div>
            <SectionTitle>Reproducción</SectionTitle>

            <SettingRow
                label='Idioma de audio preferido'
                hint='Pista de audio que se elige automáticamente al reproducir'
            >
                <SelectBox
                    value={config.AudioLanguagePreference ?? ''}
                    options={LANGUAGES}
                    onChange={(v) => patch({ AudioLanguagePreference: v })}
                />
            </SettingRow>

            <SettingRow
                label='Reproducir la pista de audio por defecto'
                hint='Ignora el idioma preferido si el archivo marca otra pista como predeterminada'
            >
                <Toggle
                    on={config.PlayDefaultAudioTrack}
                    onChange={(v) => patch({ PlayDefaultAudioTrack: v })}
                />
            </SettingRow>

            <SettingRow
                label='Recordar la pista de audio elegida'
                hint='Al cambiar de episodio se mantiene el idioma que elegiste'
            >
                <Toggle
                    on={config.RememberAudioSelections}
                    onChange={(v) => patch({ RememberAudioSelections: v })}
                />
            </SettingRow>

            <SettingRow
                label='Recordar los subtítulos elegidos'
                hint='Al cambiar de episodio se mantienen los subtítulos que elegiste'
            >
                <Toggle
                    on={config.RememberSubtitleSelections}
                    onChange={(v) => patch({ RememberSubtitleSelections: v })}
                />
            </SettingRow>

            <SettingRow
                label='Reproducción automática del siguiente episodio'
                hint='Preferencia estándar de Jellyfin, compartida con otros clientes'
            >
                <Toggle
                    on={config.EnableNextEpisodeAutoPlay}
                    onChange={(v) => patch({ EnableNextEpisodeAutoPlay: v })}
                />
            </SettingRow>

            <SettingRow
                label='Calidad máxima de streaming'
                hint='Límite de bitrate que este navegador pide al servidor (afecta al transcode)'
            >
                <SelectBox
                    value={String(bitrate)}
                    options={BITRATES.map(([v, l]) => [String(v), l] as [string, string])}
                    onChange={(v) => {
                        const bps = Number(v);
                        setMaxStreamingBitrate(bps);
                        setBitrate(bps);
                        toast('Calidad guardada — se aplica en la siguiente reproducción', 'success');
                    }}
                />
            </SettingRow>
        </div>
    );
}

// ── Subtítulos ──────────────────────────────────────────────────────────────

function SubtitleSection({
    config, patch
}: {
    config: UserConfig; patch: (p: Partial<UserConfig>) => void;
}) {
    const current = SUBTITLE_MODES.find(([m]) => m === config.SubtitleMode);
    return (
        <div>
            <SectionTitle>Subtítulos</SectionTitle>

            <SettingRow
                label='Idioma de subtítulos preferido'
                hint='Pista de subtítulos que se elige automáticamente'
            >
                <SelectBox
                    value={config.SubtitleLanguagePreference ?? ''}
                    options={LANGUAGES}
                    onChange={(v) => patch({ SubtitleLanguagePreference: v })}
                />
            </SettingRow>

            <SettingRow label='Modo de subtítulos' hint={current?.[2] ?? ''}>
                <SelectBox
                    value={config.SubtitleMode}
                    options={SUBTITLE_MODES.map(([v, l]) => [v, l] as [string, string])}
                    onChange={(v) => patch({ SubtitleMode: v as SubtitleMode })}
                />
            </SettingRow>
        </div>
    );
}

// ── Bibliotecas ─────────────────────────────────────────────────────────────

function LibrariesSection({ isAdmin, goDashboard }: { isAdmin: boolean; goDashboard: GoDashboard }) {
    const toast = useToast();
    const [views, setViews] = useState<UserView[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        getUserViews().then(setViews).catch((e) => setError((e as Error).message));
    }, []);

    const onScan = async () => {
        setScanning(true);
        try {
            await refreshLibrary();
            toast('Escaneo de bibliotecas lanzado', 'success');
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setScanning(false);
        }
    };

    const typeLabel = (t?: string) =>
        t === 'movies' ? 'Películas' : t === 'tvshows' ? 'Series' : t === 'music' ? 'Música' : t ?? '';

    return (
        <div>
            <SectionTitle>Bibliotecas</SectionTitle>
            {error ? (
                <div style={{ color: '#ff6b6b', fontSize: 14 }}>{error}</div>
            ) : !views ? (
                <div style={{ color: T.dim, fontSize: 13 }}>Cargando…</div>
            ) : (
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 20, marginBottom: 36
                }}>
                    {views.map((v) => (
                        <div key={v.id} style={{
                            borderRadius: 10, overflow: 'hidden',
                            border: `1px solid ${T.hairline}`, background: 'rgba(255,255,255,0.03)'
                        }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    aspectRatio: '16/9',
                                    backgroundImage: v.image ? `url(${v.image})` : undefined,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    backgroundSize: 'cover', backgroundPosition: 'center'
                                }} />
                                {isAdmin && (
                                    <div style={{
                                        position: 'absolute', top: 6, right: 6,
                                        background: 'rgba(0,0,0,0.5)', borderRadius: 8
                                    }}>
                                        <LibraryCardMenu libraryId={v.id} libraryName={v.name} />
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '12px 14px' }}>
                                <div style={{ fontSize: 15, fontWeight: 500 }}>{v.name}</div>
                                <div style={{ fontSize: 12, color: T.dim, marginTop: 3 }}>
                                    {typeLabel(v.collectionType)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAdmin && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button style={btnSecondary} disabled={scanning} onClick={onScan}>
                        {scanning ? 'Lanzando…' : 'Escanear todas las bibliotecas'}
                    </button>
                    <button style={btnSecondary} onClick={() => goDashboard('/libraries')}>
                        Gestionar carpetas
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Servidor ────────────────────────────────────────────────────────────────

function ServerSection({ isAdmin, goDashboard }: { isAdmin: boolean; goDashboard: GoDashboard }) {
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getSystemInfo().then(setInfo).catch((e) => setError((e as Error).message));
    }, []);

    return (
        <div>
            <SectionTitle>Servidor</SectionTitle>
            {error ? (
                <div style={{ color: '#ff6b6b', fontSize: 14 }}>{error}</div>
            ) : !info ? (
                <div style={{ color: T.dim, fontSize: 13 }}>Cargando…</div>
            ) : (
                <>
                    <InfoRow label='Nombre' value={info.serverName} />
                    <InfoRow label='Versión' value={info.version} />
                    <InfoRow label='Sistema operativo' value={info.operatingSystem || '—'} />
                    <InfoRow label='Id' value={info.id} />
                </>
            )}
            {isAdmin && (
                <div style={{ marginTop: 32 }}>
                    <button style={btnSecondary} onClick={() => goDashboard()}>
                        Configuración avanzada del servidor
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Usuarios (admin) ────────────────────────────────────────────────────────

function UsersSection({ goDashboard }: { goDashboard: GoDashboard }) {
    const [users, setUsers] = useState<UserListEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getUsers().then(setUsers).catch((e) => setError((e as Error).message));
    }, []);

    return (
        <div>
            <SectionTitle>Usuarios</SectionTitle>
            {error ? (
                <div style={{ color: '#ff6b6b', fontSize: 14 }}>{error}</div>
            ) : !users ? (
                <div style={{ color: T.dim, fontSize: 13 }}>Cargando…</div>
            ) : (
                <div style={{ marginBottom: 32 }}>
                    {users.map((u) => (
                        <div key={u.id} style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 0', borderBottom: `1px solid ${T.hairline}`, fontSize: 14
                        }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: 'linear-gradient(135deg,#d9a566,#3a1f10)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 600, flexShrink: 0
                            }}>
                                {u.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span>{u.name}</span>
                                {u.isAdmin && (
                                    <span style={{
                                        marginLeft: 10, fontSize: 10, letterSpacing: 1.5,
                                        textTransform: 'uppercase', color: '#d9a566',
                                        border: '1px solid rgba(217,165,102,0.4)',
                                        borderRadius: 999, padding: '2px 8px'
                                    }}>
                                        Admin
                                    </span>
                                )}
                                {u.isDisabled && (
                                    <span style={{ marginLeft: 10, fontSize: 12, color: '#ff6b6b' }}>
                                        Deshabilitado
                                    </span>
                                )}
                            </div>
                            <span style={{ color: T.dim, fontSize: 12 }}>
                                {u.lastActivity ?
                                    `Activo: ${new Date(u.lastActivity).toLocaleString('es-ES')}` :
                                    'Sin actividad'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ color: T.dim, fontSize: 13, marginBottom: 16 }}>
                Desde aquí puedes ver el estado; el alta, permisos y contraseñas de otros
                usuarios se editan en la gestión avanzada.
            </div>
            <button style={btnSecondary} onClick={() => goDashboard('/users')}>
                Gestionar usuarios
            </button>
        </div>
    );
}

// ── Piezas de UI compartidas ────────────────────────────────────────────────

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
            color: T.dim, marginBottom: 18, ...style
        }}>
            {children}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', padding: '14px 0',
            borderBottom: `1px solid ${T.hairline}`, fontSize: 14
        }}>
            <span style={{ color: T.dim }}>{label}</span>
            <span style={{ color: T.fg, wordBreak: 'break-all' }}>{value}</span>
        </div>
    );
}

function SettingRow({
    label, hint, children
}: {
    label: string; hint?: string; children: React.ReactNode;
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 24,
            padding: '16px 0', borderBottom: `1px solid ${T.hairline}`
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{label}</div>
                {hint && <div style={{ fontSize: 12, color: T.dim, marginTop: 3 }}>{hint}</div>}
            </div>
            <div style={{ flexShrink: 0 }}>{children}</div>
        </div>
    );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            role='switch'
            aria-checked={on}
            onClick={() => onChange(!on)}
            style={{
                width: 42, height: 24, borderRadius: 999, position: 'relative',
                background: on ? '#fff' : 'rgba(255,255,255,0.16)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'background .2s'
            }}
        >
            <span style={{
                position: 'absolute', top: 3, left: on ? 21 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: on ? '#000' : '#fff',
                transition: 'left .2s'
            }} />
        </button>
    );
}

function SelectBox({
    value, options, onChange
}: {
    value: string; options: [string, string][]; onChange: (v: string) => void;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                background: 'rgba(255,255,255,0.06)', color: T.fg,
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                padding: '9px 12px', fontFamily: T.ui, fontSize: 13,
                cursor: 'pointer', minWidth: 220, colorScheme: 'dark'
            }}
        >
            {options.map(([v, l]) => (
                // El popup nativo del select no hereda los estilos del control:
                // sin fondo/color explícitos, algunos Chromium pintan blanco
                // sobre blanco (texto invisible).
                <option key={v} value={v} style={{ background: '#141416', color: '#fff' }}>
                    {l}
                </option>
            ))}
        </select>
    );
}

const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', color: T.fg,
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
    padding: '10px 12px', fontFamily: T.ui, fontSize: 13, outline: 'none'
};

const btnSecondary: React.CSSProperties = {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.08)', color: T.fg,
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 999, fontFamily: T.ui, fontSize: 13,
    cursor: 'pointer', fontWeight: 500
};

const btnDanger: React.CSSProperties = {
    padding: '10px 20px',
    background: 'transparent', color: '#ff6b6b',
    border: '1px solid rgba(255,80,80,0.4)',
    borderRadius: 999, fontFamily: T.ui, fontSize: 13,
    cursor: 'pointer', fontWeight: 500
};
