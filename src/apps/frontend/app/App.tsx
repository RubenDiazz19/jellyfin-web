import { lazy, Suspense, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { T, type HeroPosKey, type HeroScrimKey } from '../presentation/theme/tokens';
import {
    pathToRoute,
    routeToPath,
    fromAppPath,
    toAppPath,
    type Route
} from './router';
import { HomePage } from '../presentation/pages/HomePage';
import { LibraryPage } from '../presentation/pages/LibraryPage';
import { ShowPage } from '../presentation/pages/ShowPage';
import { SeasonPage } from '../presentation/pages/SeasonPage';
import { EpisodePage } from '../presentation/pages/EpisodePage';
import { MoviePage } from '../presentation/pages/MoviePage';
import { SearchPage } from '../presentation/pages/SearchPage';
import { LoginPage } from '../presentation/pages/LoginPage';

// Páginas de acceso puntual: se cargan bajo demanda para no engordar el
// bundle inicial. React.lazy + Suspense hace el split automáticamente.
const GenrePage = lazy(() => import('../presentation/pages/GenrePage').then(m => ({ default: m.GenrePage })));
const FavoritesPage = lazy(() => import('../presentation/pages/FavoritesPage').then(m => ({ default: m.FavoritesPage })));
const PersonPage = lazy(() => import('../presentation/pages/PersonPage').then(m => ({ default: m.PersonPage })));
const SettingsPage = lazy(() => import('../presentation/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

import {
    useTweaks, TweaksPanel, TweakSection, TweakRadio
} from '../presentation/components/tweaks/TweaksPanel';
import { ErrorBoundary } from '../presentation/components/layout/ErrorBoundary';
import { ToastProvider } from '../presentation/components/toast/ToastProvider';
import { useSession } from '../domain/bridge/useSession';
import { PlayerProvider } from '../presentation/components/player/PlayerProvider';
import { useMobileTheme } from '../presentation/theme/MobileThemeProvider';
import { SCROLL_MEMORY } from '../shared/scrollMemory';

type TweakDefaults = {
    heroPos: HeroPosKey;
    heroInfo: 'Mínima' | 'Completa';
    heroScrim: HeroScrimKey;
};

const TWEAK_DEFAULTS: TweakDefaults = {
    heroPos: 'Inferior',
    heroInfo: 'Completa',
    heroScrim: 'Media'
};

function PageFallback() {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', color: T.dim, fontFamily: T.ui, fontSize: 13,
            letterSpacing: 3, textTransform: 'uppercase'
        }}>
            Cargando…
        </div>
    );
}

function AuthedApp() {
    const location = useLocation();
    const rrNavigate = useNavigate();
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    // mobile/tablet: transición slide y scroll por tab. En desktop layout es
    // null y todo lo de abajo conserva el comportamiento actual.
    const mobileLayout = useMobileTheme().layout !== null;

    // La URL activa (bajo el HashRouter raíz, useLocation().pathname devuelve
    // el path detrás del `#`). Este frontend vive en la raíz sin prefijo, así
    // que fromAppPath es identidad — se conserva por si algún día se rebasea.
    const route = useMemo<Route>(
        () => pathToRoute(fromAppPath(location.pathname)),
        [location.pathname]
    );

    const navigate = useCallback((r: Route) => {
        const path = toAppPath(routeToPath(r));
        if (path === location.pathname) {
            rrNavigate(path, { replace: true });
        } else {
            rrNavigate(path);
        }
    }, [location.pathname, rrNavigate]);

    // El navegador restaura por su cuenta la posición de scroll al movernos
    // por el historial (atrás/adelante), lo que pisa nuestro reset. Con
    // 'manual' mandamos nosotros.
    useLayoutEffect(() => {
        const prev = window.history.scrollRestoration;
        window.history.scrollRestoration = 'manual';
        return () => { window.history.scrollRestoration = prev; };
    }, []);

    // Scroll al top en cada cambio de ruta. Un único reset no basta: la
    // inercia del ratón puede seguir viva tras el click y el documento crece
    // cuando llegan datos e imágenes (lo que reabre el rango de scroll). Por
    // eso insistimos durante ~500 ms, pero cedemos en cuanto el usuario
    // scrollea a propósito para no pelearnos con él.
    // Además movemos el foco al contenedor de la página: sin esto, un usuario
    // de teclado se queda "anclado" al botón de la página anterior (ya
    // desmontado) y el orden de tabulación arranca de cualquier parte. El
    // monkey-patch de focus fuerza preventScroll, así que no compite con el
    // reset de scroll.
    const pageRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        let stopped = false;
        const release = () => { stopped = true; };
        const opts = { passive: true } as const;
        window.addEventListener('wheel', release, opts);
        window.addEventListener('touchstart', release, opts);
        window.addEventListener('keydown', release, opts);

        // En mobile/tablet los destinos de la navegación recuerdan su scroll
        // (SCROLL_MEMORY); el resto de rutas — y desktop siempre — entran
        // arriba (target 0, el comportamiento de siempre).
        const target = mobileLayout ? SCROLL_MEMORY.get(location.pathname) : 0;

        // La posición a recordar se sigue en vivo: en el cleanup el DOM de
        // la página nueva ya reemplazó al de la vieja y window.scrollY puede
        // haber quedado clampeado por el cambio de altura del documento.
        let lastY = target;
        const onScroll = () => { lastY = window.scrollY; };
        window.addEventListener('scroll', onScroll, opts);

        const reset = () => {
            window.scrollTo(0, target);
            if (document.scrollingElement) document.scrollingElement.scrollTop = target;
            document.documentElement.scrollTop = target;
            document.body.scrollTop = target;
        };
        reset();
        pageRef.current?.focus();

        const start = performance.now();
        let raf = requestAnimationFrame(function tick() {
            if (stopped) return;
            reset();
            if (performance.now() - start < 500) raf = requestAnimationFrame(tick);
        });

        return () => {
            // Guarda la posición del tab saliente antes del cambio de ruta.
            if (mobileLayout) SCROLL_MEMORY.save(location.pathname, lastY);
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('wheel', release);
            window.removeEventListener('touchstart', release);
            window.removeEventListener('keydown', release);
        };
    }, [location.pathname, mobileLayout]);

    return (
        <>
            <div
                key={location.pathname}
                ref={pageRef}
                tabIndex={-1}
                // Mobile/tablet: slide corto M3. El transform solo existe
                // durante los ~280 ms de animación (termina en `none`), así
                // que la ventana de riesgo del containing-block para menús
                // fixed (ver global.css) queda acotada. Desktop: fade actual.
                style={{
                    animation: mobileLayout ?
                        'jfp-slide-in var(--md-sys-motion-duration-medium1, 0.28s) var(--md-sys-motion-easing-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1)) both' :
                        'jfp-fade-in 0.65s ease',
                    outline: 'none'
                }}
            >
                {/* key por ruta también en la barrera: navegar resetea el error. */}
                <ErrorBoundary>
                    {route.page === 'home' && <HomePage navigate={navigate} />}
                    {route.page === 'series' && <LibraryPage kind='series' navigate={navigate} />}
                    {route.page === 'movies' && <LibraryPage kind='movies' navigate={navigate} />}
                    {route.page === 'show' && <ShowPage showId={route.showId} navigate={navigate} hero={t} />}
                    {route.page === 'season' && <SeasonPage showId={route.showId} seasonN={route.seasonN} navigate={navigate} />}
                    {route.page === 'episode' && <EpisodePage showId={route.showId} seasonN={route.seasonN} epN={route.epN} navigate={navigate} />}
                    {route.page === 'movie' && <MoviePage movieId={route.movieId} navigate={navigate} hero={t} />}
                    {route.page === 'search' && <SearchPage navigate={navigate} />}
                    <Suspense fallback={<PageFallback />}>
                        {route.page === 'favorites' && <FavoritesPage navigate={navigate} />}
                        {route.page === 'genre' && <GenrePage genre={route.genre} navigate={navigate} />}
                        {route.page === 'person' && <PersonPage name={route.name} navigate={navigate} />}
                        {route.page === 'settings' && <SettingsPage navigate={navigate} initial='reproduccion' />}
                        {route.page === 'profile' && <SettingsPage navigate={navigate} initial='perfil' />}
                    </Suspense>
                </ErrorBoundary>
            </div>
            <TweaksPanel title='Tweaks'>
                <TweakSection label='Pantalla de detalle' />
                <TweakRadio
                    label='Posición' value={t.heroPos}
                    options={['Esquina', 'Inferior', 'Centro'] as const}
                    onChange={(v) => setTweak('heroPos', v)}
                />
                <TweakRadio
                    label='Información' value={t.heroInfo}
                    options={['Mínima', 'Completa'] as const}
                    onChange={(v) => setTweak('heroInfo', v)}
                />
                <TweakRadio
                    label='Veladura' value={t.heroScrim}
                    options={['Sutil', 'Media', 'Intensa'] as const}
                    onChange={(v) => setTweak('heroScrim', v)}
                />
            </TweaksPanel>
        </>
    );
}

function Root() {
    const { session } = useSession();
    const authed = !!session?.accessToken;
    return authed ? <AuthedApp /> : <LoginPage />;
}

export default function App() {
    return (
        <ToastProvider>
            <PlayerProvider>
                <Root />
            </PlayerProvider>
        </ToastProvider>
    );
}
