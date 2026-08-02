// Las raíces de la API de Jellyfin que el dev server tiene que reenviar al
// backend (`server.proxy` en vite.config.ts).
//
// Vive fuera del config para que un test pueda leerla: cuando falta una raíz,
// lo que contesta el dev server es su propio index.html con un 200, no un 404,
// y desde el navegador eso se ve como un error de parseo de JSON a mucha
// distancia de la causa. El historial de este fichero es una lista de tardes
// perdidas en eso, así que ahora hay red — ver apiRoots.test.ts.
//
// El Caddy del contenedor NO usa esta lista: allí la regla es «si el fichero
// existe se sirve, si no va al backend», que no enumera nada y por tanto no se
// puede quedar atrás. Ver el Caddyfile.

export const JF_API_ROOTS = [
    'api', 'Audio', 'Videos', 'Images', 'System', 'Users', 'Items', 'Branding',
    'DisplayPreferences', 'Music', 'Shows', 'Movies', 'LiveTv', 'Sessions',
    'Devices', 'Playback', 'Subtitle', 'web', 'socket',
    // Listas de reproducción y colecciones. `/Playlists` y `/Collections` son
    // raíces propias (no cuelgan de `/Items`), así que sin estas dos entradas
    // el dev server no las reenviaba y crear una lista daba 404 — pero solo
    // con `bun start`; contra el backend directo funcionaba, que es lo que
    // despista al depurarlo.
    'Playlists', 'Collections',
    // Buscador del servidor (`/Search/Hints`), Quick Connect, los marcadores
    // de intro/créditos y el refresco de biblioteca desde Ajustes. Las cuatro
    // se añadieron a la app sin pasar por aquí, que es exactamente el
    // despiste que el test de al lado existe para impedir.
    'Search', 'QuickConnect', 'MediaSegments', 'Library', 'ScheduledTasks',
    // Jellyfin construye SUS PROPIAS urls de streaming en minúscula: el
    // `TranscodingUrl` que devuelve PlaybackInfo es `/videos/{id}/master.m3u8?…`
    // (literales `/videos/` y `/audio/` de StreamInfo.ToUrl, en
    // MediaBrowser.Model.dll), mientras que las que construye esta app van en
    // PascalCase. Sin estas dos entradas, `/videos/…` no emparejaba con
    // `/Videos` y el dev server contestaba su propio index.html con un 200: el
    // reproductor recibía HTML en vez del playlist, moría en 0:00 y el
    // transcode no llegaba ni a arrancar en el servidor.
    'videos', 'audio'
];

/**
 * Patrón para `server.proxy`. Solo las raíces enteras: `/video?item=…` (ruta de
 * la SPA) no debe caer aquí.
 *
 * La `?` del final del grupo importa: Vite empareja contra `req.url`, que trae
 * la query. Sin ella, `POST /Collections?name=…` —una raíz llamada con
 * parámetros y sin subruta— no casaba y el dev server contestaba un 404,
 * mientras que contra el backend directo funcionaba.
 */
export const JF_PROXY_PATTERN = `^/(?:${JF_API_ROOTS.join('|')})(?:[/?]|$)`;
