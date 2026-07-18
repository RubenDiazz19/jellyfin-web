import { ThemeProvider } from '@mui/material/styles';
import {
    RouterProvider,
    createHashRouter,
    Outlet,
    useLocation
} from 'react-router-dom';

import { DASHBOARD_APP_PATHS, DASHBOARD_APP_ROUTES } from 'apps/dashboard/routes/routes';
import { APP_ROUTES as FRONTEND_APP_ROUTES } from 'apps/frontend/app/routes';
import AppHeader from 'components/AppHeader';
import Backdrop from 'components/Backdrop';
import BangRedirect from 'components/router/BangRedirect';
import { createRouterHistory } from 'components/router/routerHistory';
import appTheme from 'themes';
import { ThemeStorageManager } from 'themes/themeStorageManager';

// Solo quedan dos apps: el dashboard oficial y el frontend custom. El
// frontend se monta como splat en la raíz y las rutas más específicas del
// dashboard ganan por especificidad de react-router-dom.
const router = createHashRouter([
    {
        element: <RootAppLayout />,
        children: [
            ...DASHBOARD_APP_ROUTES,
            ...FRONTEND_APP_ROUTES,
            {
                path: '!/*',
                Component: BangRedirect
            }
        ]
    }
]);

export const history = createRouterHistory(router);

export default function RootAppRouter() {
    return <RouterProvider router={router} />;
}

/**
 * Layout component that renders legacy components required on all pages.
 * NOTE: The app will crash if these get removed from the DOM.
 */
function RootAppLayout() {
    const location = useLocation();
    // El AppHeader solo aporta los stubs del DOM que necesitan las vistas
    // legacy del dashboard (skinHeader, mainDrawer). El frontend custom trae
    // su propio nav, así que fuera del dashboard queda oculto.
    const isDashboardPath = Object.values(DASHBOARD_APP_PATHS)
        .some(path => location.pathname.startsWith(`/${path}`));

    return (
        <ThemeProvider
            theme={appTheme}
            defaultMode='dark'
            storageManager={ThemeStorageManager}
        >
            {/* Backdrop siempre montado: rinde los divs `.backdropContainer`
                y `.backgroundContainer` que las vistas legacy del dashboard
                consultan por selector. z-index: -1, no interfiere. */}
            <Backdrop />
            <AppHeader isHidden={!isDashboardPath} />

            <Outlet />
        </ThemeProvider>
    );
}
