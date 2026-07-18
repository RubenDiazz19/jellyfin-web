import type { RouteObject } from 'react-router-dom';

// Rutas del frontend custom:
// - /video: reproductor propio (VideoPlayer + VideoPlayerViewModel). Se
//   registra fuera del splat para no envolverlo en nuestro AppLayout
//   (chrome custom, nav, etc.) y se lazy-carga junto con hls.js.
// - /*: splat que cae al AppLayout del frontend, que a su vez delega el
//   matching interno al App.tsx (useLocation/pathToRoute).
export const APP_ROUTES: RouteObject[] = [
    {
        path: '/video',
        lazy: () => import('./VideoRoute')
    },
    {
        path: '/*',
        lazy: () => import('./AppLayout')
    }
];
