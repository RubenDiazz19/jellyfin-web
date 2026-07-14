import { ThemeProvider } from '@mui/material/styles';
import React from 'react';
import {
    RouterProvider,
    createHashRouter,
    Outlet,
    useLocation
} from 'react-router-dom';

import { DASHBOARD_APP_PATHS, DASHBOARD_APP_ROUTES } from 'apps/dashboard/routes/routes';
import { APP_ROUTES as FRONTEND_APP_ROUTES } from 'apps/frontend/routes/routes';
import { WIZARD_APP_ROUTES } from 'apps/wizard/routes/routes';
import AppHeader from 'components/AppHeader';
import Backdrop from 'components/Backdrop';
import BangRedirect from 'components/router/BangRedirect';
import { createRouterHistory } from 'components/router/routerHistory';
import appTheme from 'themes';
import { ThemeStorageManager } from 'themes/themeStorageManager';

// El frontend custom sustituye al modern/legacy oficial: se monta como
// splat en la raíz, y las rutas más específicas (dashboard, wizard) siguen
// ganando por especificidad de react-router-dom.
const router = createHashRouter([
    {
        element: <RootAppLayout />,
        children: [
            ...DASHBOARD_APP_ROUTES,
            ...WIZARD_APP_ROUTES,
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
    // Sólo dashboard y wizard usan el chrome oficial (AppHeader). El resto
    // (todo lo que renderiza el frontend custom) se sirve limpio: nada de
    // Backdrop ni AppHeader, la app trae su propio nav.
    const isDashboardPath = Object.values(DASHBOARD_APP_PATHS)
        .some(path => location.pathname.startsWith(`/${path}`));
    const isWizardPath = location.pathname.startsWith('/wizard');
    const isChromePath = isDashboardPath || isWizardPath;

    return (
        <ThemeProvider
            theme={appTheme}
            defaultMode='dark'
            storageManager={ThemeStorageManager}
        >
            {/* Backdrop siempre montado: rinde los divs `.backdropContainer`
                y `.backgroundContainer` que muchos controladores legacy
                (video-osd, itemDetails…) consultan por selector y asumen
                presentes. z-index: -1, no interfiere con el frontend. */}
            <Backdrop />
            <AppHeader isHidden={!isChromePath} />

            <Outlet />
        </ThemeProvider>
    );
}
