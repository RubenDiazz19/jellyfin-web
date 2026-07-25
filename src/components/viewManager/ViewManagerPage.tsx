/// <reference types="vite/client" />
import { Action } from 'history';
import { FunctionComponent, useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

import globalize from 'lib/globalize';
import type { RestoreViewFailResponse } from 'types/viewManager';

import viewManager from './viewManager';
import { AppType } from 'constants/appType';

export interface ViewManagerPageProps {
    appType?: AppType
    controller: string
    view: string
    type?: string
    isFullscreen?: boolean
    isNowPlayingBarEnabled?: boolean
    isThemeMediaSupported?: boolean
    transition?: string
}

interface ViewOptions {
    url: string
    type?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: any
    autoFocus: boolean
    fullscreen?: boolean
    transition?: string
    options: {
        supportsThemeMedia?: boolean
        enableMediaControl?: boolean
    }
}

// Webpack (build de producción) resuelve el template literal `${controllerName}.js`
// recursivamente vía [request], pero Vite (dev server) trata `${var}` como un
// único segmento — el mapa que genera para el import dinámico sólo enumera los
// archivos en el primer nivel de `controllers/`, ignorando subcarpetas como
// `playback/video/index.js`. Con `import.meta.glob('**/*.js', { eager: false })`
// declaramos el patrón recursivo explícitamente y ambos bundlers producen el
// mismo mapa completo.
const dashboardControllers = import.meta.glob('../../apps/dashboard/controllers/**/*.js');
const dashboardViews = import.meta.glob('../../apps/dashboard/controllers/**/*.html');

const importController = (
    _appType: AppType,
    controller: string,
    view: string
) => {
    // Strip the known extensions so they are part of the static import paths
    // below, which is required for bundlers to statically analyze the imports.
    // Solo el dashboard conserva vistas legacy (controller + html).
    const controllerName = controller.replace(/\.js$/, '');
    const viewName = view.replace(/\.html$/, '');

    const base = '../../apps/dashboard/controllers/';
    const controllers = dashboardControllers;
    const views = dashboardViews;

    const controllerKey = `${base}${controllerName}.js`;
    const viewKey = `${base}${viewName}.html`;
    const controllerImporter = controllers[controllerKey];
    const viewImporter = views[viewKey];
    if (!controllerImporter) {
        return Promise.reject(new Error(`[ViewManagerPage] no controller ${controllerKey}`));
    }
    if (!viewImporter) {
        return Promise.reject(new Error(`[ViewManagerPage] no view ${viewKey}`));
    }
    return Promise.all([
        controllerImporter(),
        viewImporter().then(html => globalize.translateHtml(html))
    ]);
};

const loadView = async (
    appType: AppType,
    controller: string,
    view: string,
    viewOptions: ViewOptions
) => {
    const [ controllerFactory, viewHtml ] = await importController(appType, controller, view);

    viewManager.loadView({
        ...viewOptions,
        controllerFactory,
        view: viewHtml
    });
};

/**
 * Page component that renders legacy views via the ViewManager.
 * NOTE: Any new pages should use the generic Page component instead.
 */
const ViewManagerPage: FunctionComponent<ViewManagerPageProps> = ({
    appType = AppType.Legacy,
    controller,
    view,
    type,
    isFullscreen = false,
    isNowPlayingBarEnabled = true,
    isThemeMediaSupported = false,
    transition
}) => {
    const location = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        const loadPage = () => {
            const viewOptions = {
                url: location.pathname + location.search,
                type,
                state: location.state,
                autoFocus: false,
                fullscreen: isFullscreen,
                transition,
                options: {
                    supportsThemeMedia: isThemeMediaSupported,
                    enableMediaControl: isNowPlayingBarEnabled
                }
            };

            if (navigationType !== Action.Pop) {
                console.debug('[ViewManagerPage] loading view [%s]', view);
                return loadView(appType, controller, view, viewOptions);
            }

            console.debug('[ViewManagerPage] restoring view [%s]', view);
            return viewManager.tryRestoreView(viewOptions)
                .catch(async (result?: RestoreViewFailResponse) => {
                    if (!result?.cancelled) {
                        console.debug('[ViewManagerPage] restore failed; loading view [%s]', view);
                        return loadView(appType, controller, view, viewOptions);
                    }
                });
        };

        // Fire and forget: el efecto no puede esperar y los fallos ya se
        // gestionan dentro (tryRestoreView tiene su catch). El `void` es
        // explícito desde que viewContainer usa `import()` nativo: antes la
        // cadena venía de un paquete sin tipos y acababa en `any`, así que la
        // promesa colgante no se veía.
        void loadPage();
    },
    // location.state and navigationType are NOT included as dependencies here since dialogs will update state while the current view stays the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
        controller,
        view,
        type,
        isFullscreen,
        isNowPlayingBarEnabled,
        isThemeMediaSupported,
        transition,
        location.pathname,
        location.search
    ]);

    return null;
};

export default ViewManagerPage;
