// Navegación adaptativa M3 — SOLO mobile/tablet, con sesión iniciada.
//   móvil  (< 600px): bottom navigation bar con 5 destinos
//   tablet (≥ 600px): navigation rail vertical a la izquierda
// En desktop no renderiza nada (layout null) y el layout actual queda tal
// cual. El padding del contenido lo aplica global.css via la clase
// jfp-has-nav que este componente mantiene en <body>.

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import HomeRounded from '@mui/icons-material/HomeRounded';
import LiveTvRounded from '@mui/icons-material/LiveTvRounded';
import MovieRounded from '@mui/icons-material/MovieRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';

import {
    fromAppPath,
    pathToRoute,
    routeToPath,
    toAppPath,
    type Route
} from '../../../app/router';
import { useSession } from '../../../domain/bridge/useSession';
import { useMobileTheme } from '../../theme/MobileThemeProvider';
import { haptic } from '../../../shared/haptics';

export const NAV_CLASS = 'jfp-has-nav';

type Tab = { id: string; label: string; icon: ReactNode; route: Route };

const ICON_STYLE = { fontSize: 22 } as const;

const TABS: Tab[] = [
    { id: 'home', label: 'Inicio', icon: <HomeRounded style={ICON_STYLE} />, route: { page: 'home' } },
    { id: 'series', label: 'Series', icon: <LiveTvRounded style={ICON_STYLE} />, route: { page: 'series' } },
    { id: 'movies', label: 'Películas', icon: <MovieRounded style={ICON_STYLE} />, route: { page: 'movies' } },
    { id: 'search', label: 'Buscar', icon: <SearchRounded style={ICON_STYLE} />, route: { page: 'search' } },
    { id: 'settings', label: 'Ajustes', icon: <SettingsRounded style={ICON_STYLE} />, route: { page: 'settings' } }
];

/** Tab que debe marcarse activa para la ruta actual (null en detalle). */
function activeTab(page: Route['page']): string | null {
    switch (page) {
        case 'home': return 'home';
        case 'series': return 'series';
        case 'movies': return 'movies';
        case 'search': return 'search';
        case 'settings':
        case 'profile': return 'settings';
        default: return null;
    }
}

export function MobileNav() {
    const { layout } = useMobileTheme();
    const { session } = useSession();
    const location = useLocation();
    const navigate = useNavigate();

    const visible = layout !== null && !!session?.accessToken;

    useEffect(() => {
        document.body.classList.toggle(NAV_CLASS, visible);
        return () => { document.body.classList.remove(NAV_CLASS); };
    }, [visible]);

    if (!visible) return null;

    const isRail = layout === 'tablet';
    const active = activeTab(pathToRoute(fromAppPath(location.pathname)).page);

    const navStyle: CSSProperties = isRail ?
        {
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 120,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 12,
            width: 88,
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            background: 'var(--md-sys-color-surface-container, #161a1e)',
            animation: 'jfp-fade-in 0.25s ease-out both'
        } :
        {
            position: 'fixed',
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 120,
            display: 'flex',
            alignItems: 'stretch',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            background: 'var(--md-sys-color-surface-container, #161a1e)',
            animation: 'jfp-fade-in 0.25s ease-out both'
        };

    return (
        <nav aria-label='Navegación principal' data-variant={isRail ? 'rail' : 'bar'} style={navStyle}>
            {TABS.map((tab) => {
                const isActive = tab.id === active;
                return (
                    <button
                        key={tab.id}
                        data-ripple
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => {
                            if (!isActive) haptic('select');
                            navigate(toAppPath(routeToPath(tab.route)));
                        }}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            flex: isRail ? undefined : 1,
                            padding: isRail ? '6px 0' : '10px 0 14px',
                            background: 'none',
                            border: 'none',
                            fontFamily: 'inherit',
                            color: isActive ?
                                'var(--md-sys-color-on-surface, #fff)' :
                                'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.65))',
                            cursor: 'pointer',
                            WebkitTapHighlightColor: 'transparent',
                            touchAction: 'manipulation'
                        }}
                    >
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 56,
                            height: 32,
                            borderRadius: 'var(--md-sys-shape-corner-full, 9999px)',
                            background: isActive ?
                                'var(--md-sys-color-secondary-container, rgba(255,255,255,0.16))' :
                                'transparent',
                            color: isActive ?
                                'var(--md-sys-color-on-secondary-container, #fff)' :
                                'inherit',
                            transition: 'background 0.2s ease'
                        }}
                        >
                            {tab.icon}
                        </span>
                        <span style={{
                            fontSize: 'var(--md-sys-typescale-label-medium-size, 12px)',
                            fontWeight: isActive ? 600 : 500,
                            letterSpacing: 'var(--md-sys-typescale-label-medium-tracking, 0.5px)'
                        }}
                        >
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
