// Pantalla completa vía Fullscreen API. Se usa desde el interceptor de F11
// (main.tsx) y podría reutilizarse desde un botón si más adelante lo
// añadimos otra vez. Los prefijos con `webkit*` cubren navegadores viejos
// y algunos derivados (p.ej. Samsung Internet).

export const isFullscreen = (): boolean =>
    !!(document.fullscreenElement || (document as any).webkitFullscreenElement);

export async function toggleFullscreen(): Promise<void> {
    try {
        if (isFullscreen()) {
            await (document.exitFullscreen?.()
        ?? (document as any).webkitExitFullscreen?.());
        } else {
            const el: any = document.documentElement;
            await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
        }
    } catch {
    // Algunos navegadores rechazan la petición si el gesto de usuario ya
    // se consumió, o si la ventana está en un iframe sin allow="fullscreen".
    // Silencioso: no rompemos la app por un warning.
    }
}
