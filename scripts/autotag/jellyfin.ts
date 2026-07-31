// Lectura de la biblioteca desde Jellyfin, con clave de API.
//
// Es el mismo servidor que usa la app, pero autenticado como administrador con
// una API key en vez de con una sesión de usuario: el script corre en la
// terminal y no tiene ningún login detrás.

import type { PromptItem } from './prompt';

export type JellyfinConfig = {
    server: string;
    apiKey: string;
    userId?: string;
};

type JFUser = { Id: string; Name: string; Policy?: { IsAdministrator?: boolean } };

type JFLibraryItem = {
    Id: string;
    Name: string;
    Type?: string;
    ProductionYear?: number;
    Overview?: string;
    Genres?: string[];
    Tags?: string[];
};

async function get<T>(cfg: JellyfinConfig, path: string): Promise<T> {
    const res = await fetch(`${cfg.server.replace(/\/$/, '')}${path}`, {
        headers: { Authorization: `MediaBrowser Token="${cfg.apiKey}"` }
    });
    if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        const detail = body ? ` — ${body}` : '';
        throw new Error(`Jellyfin ${res.status} en ${path}${detail}`);
    }
    return res.json() as Promise<T>;
}

/**
 * Resuelve el usuario contra el que consultar. Se piden los items por usuario
 * —`/Users/{id}/Items`— y no por el endpoint global porque es la ruta que la
 * propia app usa y la que se comporta igual en todas las versiones.
 */
export async function resolveUserId(cfg: JellyfinConfig): Promise<string> {
    if (cfg.userId) return cfg.userId;
    const users = await get<JFUser[]>(cfg, '/Users');
    const admin = users.find((u) => u.Policy?.IsAdministrator) ?? users[0];
    if (!admin) throw new Error('El servidor no devolvió ningún usuario');
    return admin.Id;
}

export async function fetchLibrary(
    cfg: JellyfinConfig, userId: string, kinds: 'all' | 'movies' | 'series'
): Promise<PromptItem[]> {
    const types = { all: 'Movie,Series', movies: 'Movie', series: 'Series' }[kinds];
    const data = await get<{ Items: JFLibraryItem[] }>(
        cfg,
        `/Users/${userId}/Items?Recursive=true&IncludeItemTypes=${types}`
            + '&Fields=Overview,Genres,Tags,ProductionYear&SortBy=SortName'
            + '&EnableTotalRecordCount=false'
    );
    return (data.Items ?? []).map((item) => ({
        id: item.Id,
        kind: item.Type === 'Series' ? 'Serie' : 'Película',
        title: item.Name,
        year: item.ProductionYear,
        genres: item.Genres ?? [],
        keywords: item.Tags ?? [],
        overview: item.Overview ?? ''
    }));
}
