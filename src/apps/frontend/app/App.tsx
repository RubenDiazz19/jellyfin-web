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
const PersonPage = lazy(() => import('../presentation/pages/PersonPage').then(m => ({ default: m.PersonPage })));
const SettingsPage = lazy(() => import('../presentation/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

import {
    useTweaks, TweaksPanel, TweakSection, TweakRadio
} from '../presentation/components/tweaks/TweaksPanel';
import { ErrorBoundary } from '../presentation/components/layout/ErrorBoundary';
import { ToastProvider } from '../presentation/components/toast/ToastProvider';
import { useSession } from '../domain/bridge/useSession';
import { PlayerProvider } from '../presentation/components/player/PlayerProvider';

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

    // Scroll al top en cada cambio de ruta: el HashRouter no restaura scroll y
    // React 18 puede diferir el commit, así que forzamos el reset en el ciclo
    // de layout y en el rAF siguiente por si algún efecto vuelve a scrollear.
    // Además movemos el foco al contenedor de la página: sin esto, un usuario
    // de teclado se queda "anclado" al botón de la página anterior (ya
    // desmontado) y el orden de tabulación arranca de cualquier parte. El
    // monkey-patch de focus fuerza preventScroll, así que no compite con el
    // reset de scroll.
    const pageRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const reset = () => {
            window.scrollTo(0, 0);
            if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        };
        reset();
        pageRef.current?.focus();
        const raf = requestAnimationFrame(reset);
        return () => cancelAnimationFrame(raf);
    }, [location.pathname]);

    return (
        <>
            <div
                key={location.pathname}
                ref={pageRef}
                tabIndex={-1}
                style={{ animation: 'jfp-fade-in 0.65s ease', outline: 'none' }}
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
