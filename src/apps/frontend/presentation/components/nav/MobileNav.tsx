// Navegación adaptativa M3 Expressive — SOLO mobile/tablet, con sesión
// iniciada.
//
// Son tres segmentos sueltos, no una cápsula continua: el destino activo se
// alarga en píldora con su nombre y los otros dos se quedan en un cuadrado
// redondeado con solo el icono. Así la navegación ocupa lo justo (y el nombre
// de dónde estás se lee sin apretar tres etiquetas en una barra).
//   móvil  (< 600px): abajo, centrados
//   tablet (≥ 600px) EN VERTICAL: apilados a la izquierda
//   cualquier pantalla EN HORIZONTAL: abajo y centrados
//
// Por qué el rail solo en vertical: al girar el móvil, el ancho pasa de 390 a
// 844 y la regla de M3 (rail a partir de 600px de ancho) mandaba la barra al
// lateral. La navegación se movía de sitio al girar el dispositivo, que es
// justo lo que no debe pasar; y tumbado sobra ancho y falta alto, así que la
// píldora de abajo estorba menos que una columna comiéndose el lateral.
// En desktop no renderiza nada (layout null) y el layout actual queda tal
// cual. El hueco del contenido lo aplica global.css con las custom properties
// que este componente publica (navMetrics.ts) junto a la clase jfp-has-nav.
//
// El color sale del contenido: la píldora usa surface-container-high y el
// indicador activo primary-container, y esos tokens los deriva el tema del
// backdrop/póster que se esté viendo (dynamicColor.ts).

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import globalize from 'lib/globalize';

import CollectionsBookmarkRounded from '@mui/icons-material/CollectionsBookmarkRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';

import {
    fromAppPath,
    pathToRoute,
    routeToPath,
    toAppPath,
    type Route
} from '../../../app/router';
import { useSession } from '../../../domain/bridge/useSession';
import { searchVM } from '../../../domain/viewModels/SearchViewModel';
import { useSignalValue } from '../../../domain/bridge/useViewModel';
import { useMobileTheme } from '../../theme/MobileThemeProvider';
import { useLandscape } from '../../theme/responsive';
import { haptic } from '../../../shared/haptics';
import {
    NAV_BOTTOM_VAR,
    NAV_GAP,
    NAV_HEIGHT,
    NAV_LEFT_VAR,
    NAV_MARGIN,
    RAIL_MARGIN,
    navSpace
} from './navMetrics';

export const NAV_CLASS = 'jfp-has-nav';

/** Un segmento lleva a una página, o —la búsqueda— abre su capa encima. */
type Tab = { id: string; key: string; icon: ReactNode; route?: Route };

const ICON_STYLE = { fontSize: 22 } as const;

// Portada, búsqueda y listas. La búsqueda está aquí y no arriba a la derecha
// porque en un móvil el pulgar llega abajo y no al canto superior; en
// escritorio la lupa sigue donde estaba (Nav.tsx), que allí manda el ratón.
// Ajustes sigue dentro del menú del avatar: no es un sitio donde uno «esté».
const TABS: Tab[] = [
    { id: 'home', key: 'Home', icon: <HomeRounded style={ICON_STYLE} />, route: { page: 'home' } },
    { id: 'search', key: 'Search', icon: <SearchRounded style={ICON_STYLE} /> },
    {
        id: 'lists',
        key: 'Lists',
        icon: <CollectionsBookmarkRounded style={ICON_STYLE} />,
        route: { page: 'lists' }
    }
];

// Superficie de un segmento en reposo: translúcida donde haya color-mix
// (global.css la define con @supports), opaca donde no. El desenfoque deja
// pasar el color del backdrop que hay debajo.
const SEGMENT: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: NAV_HEIGHT,
    height: NAV_HEIGHT,
    border: '1px solid var(--jfp-nav-outline, transparent)',
    boxShadow: 'var(--md-sys-elevation-level2, 0 4px 12px rgba(0,0,0,0.35))',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    transition: 'background var(--md-sys-motion-duration-short4, 200ms)'
        + ' var(--md-sys-motion-easing-standard, cubic-bezier(0.2, 0, 0, 1)),'
        + ' border-radius var(--md-sys-motion-duration-medium2, 300ms)'
        + ' var(--md-sys-motion-easing-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1))'
};

const ENTER_EASING = 'var(--md-sys-motion-easing-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1))';

/** Tab que debe marcarse activa para la ruta actual (null en detalle). */
function activeTab(page: Route['page']): string | null {
    switch (page) {
        case 'home': return 'home';
        // La ficha de una lista es «estar» en Listas, igual que la portada.
        case 'lists': return 'lists';
        case 'list': return 'lists';
        default: return null;
    }
}

export function MobileNav() {
    const { layout } = useMobileTheme();
    const landscape = useLandscape();
    const { session } = useSession();
    const location = useLocation();
    const navigate = useNavigate();
    // La búsqueda no es una página: se marca activa mientras su capa está
    // abierta, que es lo que el segmento representa en ese momento.
    const searching = useSignalValue(searchVM.overlayOpen);

    const visible = layout !== null && !!session?.accessToken;
    const isRail = layout === 'tablet' && !landscape;

    useEffect(() => {
        const root = document.documentElement;
        document.body.classList.toggle(NAV_CLASS, visible);
        if (visible) {
            const space = navSpace(isRail);
            root.style.setProperty(NAV_BOTTOM_VAR, space.bottom);
            root.style.setProperty(NAV_LEFT_VAR, space.left);
        } else {
            root.style.removeProperty(NAV_BOTTOM_VAR);
            root.style.removeProperty(NAV_LEFT_VAR);
        }
        return () => {
            document.body.classList.remove(NAV_CLASS);
            root.style.removeProperty(NAV_BOTTOM_VAR);
            root.style.removeProperty(NAV_LEFT_VAR);
        };
    }, [visible, isRail]);

    if (!visible) return null;

    // La capa de búsqueda tapa la página, así que mientras está abierta manda
    // ella: dejar además marcada la de debajo sería marcar dos.
    const active = searching ?
        'search' :
        activeTab(pathToRoute(fromAppPath(location.pathname)).page);

    // El contenedor no pinta nada: es solo la fila (o columna) de segmentos.
    // `fit-content` + márgenes automáticos = ocupa lo justo y va centrado.
    const navStyle: CSSProperties = isRail ?
        {
            position: 'fixed',
            zIndex: 120,
            top: '50%',
            left: `calc(${RAIL_MARGIN}px + env(safe-area-inset-left, 0px))`,
            transform: 'translateY(-50%)',
            animation: `jfp-rail-in 0.42s ${ENTER_EASING} both`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: NAV_GAP
        } :
        {
            position: 'fixed',
            zIndex: 120,
            left: 0,
            right: 0,
            bottom: `calc(${NAV_MARGIN}px + env(safe-area-inset-bottom, 0px))`,
            width: 'fit-content',
            maxWidth: `calc(100% - ${NAV_MARGIN * 2}px)`,
            margin: '0 auto',
            animation: `jfp-nav-in 0.42s ${ENTER_EASING} both`,
            display: 'flex',
            alignItems: 'center',
            gap: NAV_GAP
        };

    return (
        <nav aria-label={globalize.translate('LabelMainNavigation')} data-variant={isRail ? 'rail' : 'bar'} style={navStyle}>
            {TABS.map((tab) => {
                const isActive = tab.id === active;
                const label = globalize.translate(tab.key);
                return (
                    <button
                        key={tab.id}
                        data-ripple
                        // La búsqueda no es una página: se anuncia como una capa
                        // que se abre, no como el sitio donde uno está.
                        aria-current={isActive && tab.route ? 'page' : undefined}
                        aria-expanded={tab.route ? undefined : searching}
                        // El nombre accesible no depende de que se vea la
                        // etiqueta: en reposo el segmento es solo el icono.
                        aria-label={label}
                        title={label}
                        onClick={() => {
                            if (!isActive) haptic('select');
                            // Pulsar cualquier segmento sale de la búsqueda,
                            // incluido el suyo (que así abre y cierra). Se
                            // cierra aquí y no solo al cambiar de página: si ya
                            // estabas en el destino la URL no cambia, y la capa
                            // se quedaría puesta obligando a buscar la X.
                            if (searching) searchVM.closeOverlay();
                            if (tab.route) navigate(toAppPath(routeToPath(tab.route)));
                            else if (!searching) searchVM.openOverlay();
                        }}
                        style={{
                            ...SEGMENT,
                            gap: isActive ? 8 : 0,
                            // El activo se estira para dejar sitio a su nombre
                            // y se redondea del todo; los otros dos se quedan
                            // en un cuadrado redondeado del tamaño del icono.
                            padding: isActive && !isRail ? '0 18px' : 0,
                            borderRadius: isActive ?
                                'var(--md-sys-shape-corner-full, 9999px)' :
                                'var(--md-sys-shape-corner-large, 16px)',
                            background: isActive ?
                                'var(--md-sys-color-primary-container, rgba(255,255,255,0.18))' :
                                'var(--jfp-nav-surface, var(--md-sys-color-surface-container-high, #202020))',
                            color: isActive ?
                                'var(--md-sys-color-on-primary-container, #fff)' :
                                'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.7))'
                        }}
                    >
                        {tab.icon}
                        {/* La etiqueta solo en el destino activo: es lo que
                            mantiene la navegación en lo justo y necesario. */}
                        {isActive && !isRail && (
                            <span style={{
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: 'var(--md-sys-typescale-label-large-size, 14px)',
                                lineHeight: 1.2,
                                // Peso *emphasized* del spec 2025.
                                fontWeight: 'var(--md-sys-typescale-label-large-emphasized-weight, 700)',
                                letterSpacing: 'var(--md-sys-typescale-label-large-tracking, 0.1px)'
                            }}
                            >
                                {label}
                            </span>
                        )}
                    </button>
                );
            })}
        </nav>
    );
}
