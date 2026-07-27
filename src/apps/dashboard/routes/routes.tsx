import { Navigate, RouteObject } from 'react-router-dom';

import ConnectionRequired from 'components/ConnectionRequired';
import { ASYNC_ADMIN_ROUTES } from './_asyncRoutes';
import { toAsyncPageRoute } from 'components/router/AsyncRoute';
import ServerContentPage from 'components/ServerContentPage';
import ErrorBoundary from 'components/router/ErrorBoundary';

export const DASHBOARD_APP_PATHS = {
    Dashboard: 'dashboard',
    PluginConfig: 'configurationpage'
};

export const DASHBOARD_APP_ROUTES: RouteObject[] = [
    {
        element: <ConnectionRequired level='admin' />,
        children: [
            {
                lazy: () => import('../AppLayout'),
                children: [
                    {
                        path: DASHBOARD_APP_PATHS.Dashboard,
                        children: [
                            ...ASYNC_ADMIN_ROUTES.map(toAsyncPageRoute),
                            {
                                path: 'plugins/catalog',
                                element: <Navigate replace to='/dashboard/plugins' />
                            }
                        ],
                        errorElement: <ErrorBoundary pageClasses={[ 'type-interior' ]} />
                    },

                    {
                        path: DASHBOARD_APP_PATHS.PluginConfig,
                        element: <ServerContentPage view='/web/configurationpage' />
                    }
                ]
            }
        ]
    }
];
