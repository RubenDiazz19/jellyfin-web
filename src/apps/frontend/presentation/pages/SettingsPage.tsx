import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import globalize from 'lib/globalize';

import {
    getCurrentUser, setSessionUser, updateUserConfig,
    type CurrentUser, type UserConfig
} from '../../domain/api';
import { useSession } from '../../domain/bridge/useSession';
import { Nav } from '../components/layout/Nav';
import { useToast } from '../components/toast/ToastProvider';
import { PageTitle } from '../components/layout/Title';
import { useResponsive } from '../theme/responsive';
import { C, T } from '../theme/tokens';
import { AppearanceSection } from './settings/AppearanceSection';
import { DisplaySection } from './settings/DisplaySection';
import { LibrariesSection } from './settings/LibrariesSection';
import { PlaybackSection } from './settings/PlaybackSection';
import { ProfileSection } from './settings/ProfileSection';
import { ServerSection } from './settings/ServerSection';
import { SubtitleSection } from './settings/SubtitleSection';
import { UsersSection } from './settings/UsersSection';
import { MobileSettingsItem } from './settings/ui';
import type { GoDashboard, MobileSectionId, SectionId } from './settings/types';
import type { Navigate } from '../../app/router';

// Ajustes de usuario contra la API real de Jellyfin: la idea es no tener que
// abrir el web nativo para las preferencias del día a día. Toda la
// administración se centraliza aquí; las herramientas profundas de servidor
// (carpetas, plugins, alta de usuarios) enlazan al dashboard embebido de la
// propia app (#/dashboard).

export function SettingsPage({ navigate, initial = 'perfil' }: { navigate: Navigate; initial?: SectionId }) {
    const { session, logout } = useSession();
    const toast = useToast();
    const r = useResponsive();
    const isReal = !!session?.accessToken;
    const [section, setSection] = useState<SectionId>(initial);
    // Drill-down móvil: null = lista de secciones. Entrar por /profile abre
    // Perfil directamente; entrar por /settings muestra la lista.
    const [mobileOpen, setMobileOpen] = useState<MobileSectionId | null>(
        initial === 'perfil' ? 'perfil' : null
    );
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
            toast(globalize.translate('SettingsSaved'), 'success');
        } catch (e) {
            setUser({ ...user, config: prev });
            toast((e as Error).message, 'warn');
        }
    };

    const sections: { id: SectionId; label: string }[] = [
        { id: 'perfil', label: globalize.translate('Profile') },
        { id: 'pantalla', label: globalize.translate('Display') },
        { id: 'reproduccion', label: globalize.translate('TitlePlayback') },
        { id: 'subtitulos', label: globalize.translate('Subtitles') },
        { id: 'bibliotecas', label: globalize.translate('HeaderLibraries') },
        { id: 'servidor', label: globalize.translate('TabServer') },
        ...(user?.isAdmin ? [{ id: 'usuarios' as SectionId, label: globalize.translate('HeaderUsers') }] : [])
    ];

    // Panel de una sección — compartido por el layout de escritorio (dos
    // columnas) y el drill-down móvil.
    const renderPanel = (id: SectionId) => (
        <>
            {id === 'perfil' && (
                <ProfileSection
                    user={user as CurrentUser}
                    serverUrl={session?.serverUrl ?? ''}
                    onAvatarChange={() => {
                        getCurrentUser().then((u) => {
                            setUser(u);
                            // El avatar de la barra superior sale de la sesión:
                            // sin esto, cambiar la foto aquí no se vería arriba
                            // hasta recargar la página.
                            setSessionUser(u.name, u.avatarTag);
                        }).catch(() => {});
                    }}
                    logout={logout}
                />
            )}
            {id === 'pantalla' && (
                <DisplaySection config={(user as CurrentUser).config} patch={patchConfig} />
            )}
            {id === 'reproduccion' && (
                <PlaybackSection config={(user as CurrentUser).config} patch={patchConfig} />
            )}
            {id === 'subtitulos' && (
                <SubtitleSection config={(user as CurrentUser).config} patch={patchConfig} />
            )}
            {id === 'bibliotecas' && (
                <LibrariesSection isAdmin={!!user?.isAdmin} goDashboard={goDashboard} />
            )}
            {id === 'servidor' && (
                <ServerSection isAdmin={!!user?.isAdmin} goDashboard={goDashboard} />
            )}
            {id === 'usuarios' && user?.isAdmin && (
                <UsersSection goDashboard={goDashboard} />
            )}
        </>
    );

    // Estado de carga común (sesión/errores) — null cuando ya hay usuario.
    const status = !isReal ? (
        <div style={{ color: T.dim, fontSize: 14 }}>
            {globalize.translate('SettingsRequireSignIn')}
        </div>
    ) : loadError ? (
        <div style={{ color: '#ff6b6b', fontSize: 14 }}>{loadError}</div>
    ) : !user ? (
        <div style={{
            color: T.dim, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase'
        }}>
            {globalize.translate('Loading')}
        </div>
    ) : null;

    const breadcrumb = [
        { label: globalize.translate('Home'), to: { page: 'home' as const } },
        { label: globalize.translate('Settings') }
    ];

    // ── Layout móvil/tablet: lista M3 con drill-down (spec 4.5) ─────────
    if (r.touch) {
        return (
            <>
                <Nav navigate={navigate} breadcrumb={breadcrumb} />
                <section style={{
                    background: C.bg, color: C.fg, minHeight: '100vh',
                    padding: `76px ${r.pagePad + 4}px 48px`, fontFamily: T.ui
                }}>
                    {mobileOpen === null ? (
                        <>
                            <h1 style={{
                                fontFamily: T.ui, fontWeight: 300,
                                fontSize: 32, margin: '0 0 18px', letterSpacing: -0.5
                            }}>
                                {globalize.translate('Settings')}
                            </h1>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <MobileSettingsItem
                                    label={globalize.translate('Appearance')}
                                    hint={globalize.translate('AppearanceHelp')}
                                    onClick={() => setMobileOpen('apariencia')}
                                />
                                {sections.map((item) => (
                                    <MobileSettingsItem
                                        key={item.id}
                                        label={item.label}
                                        onClick={() => setMobileOpen(item.id)}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setMobileOpen(null)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    margin: '0 0 20px', padding: '8px 0',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--md-sys-color-primary, #fff)',
                                    fontFamily: T.ui, fontSize: 14, fontWeight: 500
                                }}
                            >
                                <span aria-hidden='true'>‹</span> {globalize.translate('Settings')}
                            </button>
                            {mobileOpen === 'apariencia' ?
                                <AppearanceSection /> :
                                (status ?? renderPanel(mobileOpen))}
                        </>
                    )}
                </section>
            </>
        );
    }

    return (
        <>
            <Nav navigate={navigate} breadcrumb={breadcrumb} />
            <section style={{
                background: '#000', color: '#fff', minHeight: '100vh',
                padding: '120px 56px 96px', fontFamily: T.ui
            }}>
                <PageTitle margin='0 0 44px'>{globalize.translate('Settings')}</PageTitle>

                <div style={{
                    display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)',
                    gap: 56, alignItems: 'start', maxWidth: 1100
                }}>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {sections.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSection(item.id)}
                                aria-current={section === item.id ? 'true' : undefined}
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
                        {status ?? renderPanel(section)}
                    </div>
                </div>
            </section>
        </>
    );
}
