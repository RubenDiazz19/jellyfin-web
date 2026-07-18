import type { RouteObject } from 'react-router-dom';

import type { AppType } from 'constants/appType';

export interface AsyncRoute {
    /** The URL path for this route. */
    path: string
    /**
     * The relative path to the page component in the routes directory.
     * Will fallback to using the `path` value if not specified.
     */
    page?: string
    /** The app that this page is part of. */
    type?: AppType
}

// NOTE: Route files use mixed extensions (.ts/.tsx), so these imports cannot
// include an extension in their static part for Vite to analyze them.
// The @vite-ignore comment suppresses the warning; the Vite dev server still
// resolves the extensionless request at runtime. Production uses webpack,
// which code-splits these through its own context module.
// Solo queda el dashboard como app con rutas async; el resto de apps
// (legacy/modern/wizard) se eliminaron con el frontend custom.
const importRoute = (page: string) => {
    return import(/* @vite-ignore */ `../../apps/dashboard/routes/${page}`);
};

export const toAsyncPageRoute = ({
    path,
    page
}: AsyncRoute): RouteObject => {
    return {
        path,
        lazy: async () => {
            const {
                // If there is a default export, use it as the Component for compatibility
                default: Component,
                ...route
            } = await importRoute(page ?? path);

            return {
                Component,
                ...route
            };
        }
    };
};
