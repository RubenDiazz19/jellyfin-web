export declare global {
    import { ConnectedServerHandle } from 'lib/jellyfin-apiclient/connectResponse';

    interface Window {
        /**
         * Cliente del servidor activo, que la capa de conexión publica aquí
         * para el código legacy. Se tipa por forma (los getters que se leen de
         * él) y no con la clase del paquete: así lo de detrás puede cambiar sin
         * tocar a quien lo lee. Hoy el único lector es `utils/dashboard`.
         */
        ApiClient: ConnectedServerHandle;
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
