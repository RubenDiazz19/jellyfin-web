import type { RouteObject } from 'react-router-dom';

// Rutas del frontend custom:
// - /video: reutiliza la VideoPage oficial del modern (OSD, controles play/
//   pausa/subtítulos, etc.) — es a donde redirige playbackManager cuando
//   arrancas un ítem. Se registra fuera del splat para no envolverla en
//   nuestro AppLayout (chrome custom, nav, etc.) y se lazy-carga para no
//   arrastrar AppToolbar en el bundle inicial.
// - /*: splat que cae al AppLayout del frontend, que a su vez delega el
//   matching interno al App.tsx (useLocation/pathToRoute).
export const APP_ROUTES: RouteObject[] = [
    {
        path: '/video',
        lazy: () => import('./VideoRoute')
    },
    {
        path: '/*',
        lazy: () => import('../AppLayout')
    }
];
