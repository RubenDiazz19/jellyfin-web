// Pantalla completa vía Fullscreen API. Se usa desde el interceptor de F11
// (main.tsx) y podría reutilizarse desde un botón si más adelante lo
// añadimos otra vez. Los prefijos con `webkit*` cubren navegadores viejos
// y algunos derivados (p.ej. Samsung Internet).

// Las variantes con prefijo no están en lib.dom, así que se declaran aquí en
// vez de castear a `any`: el resto del fichero sigue tipado y, si alguna de
// estas firmas deja de encajar, TypeScript lo dice.
type WebkitDocument = Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

const doc = (): WebkitDocument => document as WebkitDocument;

export const isFullscreen = (): boolean =>
    !!(document.fullscreenElement || doc().webkitFullscreenElement);

export async function toggleFullscreen(): Promise<void> {
    try {
        if (isFullscreen()) {
            await (document.exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
        } else {
            const el = document.documentElement as WebkitElement;
            await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
        }
    } catch {
    // Algunos navegadores rechazan la petición si el gesto de usuario ya
    // se consumió, o si la ventana está en un iframe sin allow="fullscreen".
    // Silencioso: no rompemos la app por un warning.
    }
}
