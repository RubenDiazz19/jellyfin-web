// Carga del sender SDK de Google Cast y tipos mínimos de la superficie que
// usamos. El SDK se sirve desde gstatic y publica el global `chrome.cast`;
// no hay paquete npm oficial, así que declaramos aquí solo lo necesario en
// vez de arrastrar un @types completo.

const SENDER_SRC = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js';

/** Canal propio de Jellyfin: el receptor habla este protocolo, no el media por defecto. */
export const JELLYFIN_CAST_NAMESPACE = 'urn:x-cast:com.connectsdk';

export type CastSession = {
    sessionId: string;
    receiver?: { friendlyName?: string };
    addMessageListener(namespace: string, listener: (ns: string, message: string) => void): void;
    removeMessageListener?(namespace: string, listener: (ns: string, message: string) => void): void;
    addUpdateListener(listener: (isAlive: boolean) => void): void;
    sendMessage(
        namespace: string,
        message: unknown,
        onSuccess: () => void,
        onError: (err: unknown) => void
    ): void;
    stop(onSuccess: () => void, onError: (err: unknown) => void): void;
};

type CastApi = {
    isAvailable?: boolean;
    ReceiverAvailability: { AVAILABLE: string };
    SessionRequest: new (appId: string) => unknown;
    ApiConfig: new (
        sessionRequest: unknown,
        sessionListener: (session: CastSession) => void,
        receiverListener: (availability: string) => void
    ) => unknown;
    initialize(config: unknown, onSuccess: () => void, onError: (err: unknown) => void): void;
    requestSession(onSuccess: (session: CastSession) => void, onError: (err: unknown) => void): void;
};

declare global {
    interface Window {
        chrome?: { cast?: CastApi };
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nombre fijado por el SDK de Google Cast
        __onGCastApiAvailable?: (isAvailable: boolean) => void;
    }
}

let loader: Promise<CastApi | null> | null = null;

/**
 * Inyecta el script del sender y resuelve cuando el SDK avisa de que está
 * listo. Resuelve a null si no hay soporte (navegador sin Cast, red caída o
 * el usuario ha bloqueado gstatic): el llamante simplemente no ofrece Cast.
 */
export function loadCastSender(timeoutMs = 8000): Promise<CastApi | null> {
    if (loader) return loader;

    loader = new Promise<CastApi | null>((resolve) => {
        if (typeof document === 'undefined') return resolve(null);
        if (window.chrome?.cast?.isAvailable) return resolve(window.chrome.cast);

        let settled = false;
        const finish = (api: CastApi | null) => {
            if (settled) return;
            settled = true;
            resolve(api);
        };

        // El SDK llama a este global cuando termina de inicializarse; es la
        // única señal fiable (el onload del <script> llega antes).
        const previous = window.__onGCastApiAvailable;
        window.__onGCastApiAvailable = (isAvailable) => {
            previous?.(isAvailable);
            finish(isAvailable && window.chrome?.cast ? window.chrome.cast : null);
        };

        const script = document.createElement('script');
        script.src = SENDER_SRC;
        script.async = true;
        script.onerror = () => finish(null);
        document.head.appendChild(script);

        // Sin receptores en la red el SDK puede no llamar nunca al callback.
        setTimeout(() => finish(window.chrome?.cast?.isAvailable ? window.chrome.cast : null), timeoutMs);
    });

    return loader;
}
