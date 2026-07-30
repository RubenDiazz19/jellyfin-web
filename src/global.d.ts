export declare global {
    import ServerHandle from 'lib/jellyfin-apiclient/serverHandle';

    interface Window {
        /**
         * El servidor activo, que la capa de conexión publica aquí para el
         * código legacy. Hoy el único lector es `utils/dashboard`.
         */
        ApiClient: ServerHandle;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        NativeShell: any;
        Loading: {
            show();
            hide();
        }
    }

    interface DocumentEventMap {
        'viewshow': CustomEvent;
    }

    const __COMMIT_SHA__: string;
    const __JF_BUILD_VERSION__: string;
    const __PACKAGE_JSON_NAME__: string;
    const __PACKAGE_JSON_VERSION__: string;
    const __USE_SYSTEM_FONTS__: boolean;
    const __WEBPACK_SERVE__: boolean;
}
