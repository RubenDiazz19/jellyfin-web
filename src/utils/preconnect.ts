// Abre la conexión con el servidor Jellyfin (DNS + TCP + TLS) en cuanto se sabe
// su URL, sin esperar a la primera petición. No puede ir en index.html: el
// servidor lo elige el usuario al iniciar sesión y puede ser cualquier host, así
// que el origen solo se conoce en runtime.

/** Origen ya anunciado, para no repetir el <link> en cada llamada. */
const announced = new Set<string>();

/**
 * Precalienta la conexión al origen de `serverUrl`. No hace nada si es el mismo
 * origen que la página (ahí la conexión ya está abierta: es la que ha traído el
 * HTML) ni si la URL no es válida.
 *
 * Emite DOS preconnect al mismo host a propósito. El navegador mantiene pools
 * separados para conexiones anónimas y con credenciales, y la app usa las dos:
 * las llamadas a la API van por `fetch` en modo CORS sin credenciales
 * (anónima → `crossorigin`), mientras que las imágenes son `<img src>` sin
 * atributo `crossorigin` (no-CORS → sin él). Con uno solo, la mitad de las
 * peticiones seguiría pagando el handshake.
 */
export function preconnectToServer(serverUrl: string | null | undefined): void {
    if (!serverUrl || typeof document === 'undefined') return;

    let origin: string;
    try {
        origin = new URL(serverUrl, window.location.href).origin;
    } catch {
        return;
    }
    if (origin === window.location.origin || announced.has(origin)) return;
    announced.add(origin);

    for (const anonymous of [true, false]) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        if (anonymous) link.crossOrigin = '';
        document.head.appendChild(link);
    }
}

/** Solo para los tests: olvida los orígenes ya anunciados. */
export function resetPreconnectForTests(): void {
    announced.clear();
}
