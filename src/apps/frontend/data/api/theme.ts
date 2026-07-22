// Sincronización de las preferencias de tema con el server vía
// DisplayPreferences.CustomPrefs. Usamos un client propio ('jfp') para no
// pisar las display preferences del cliente oficial de jellyfin-web.

import { loadSession } from '../session/session';
import { apiFetch, apiSend } from './http';

const CLIENT = 'jfp';

type DisplayPrefs = {
    Id?: string;
    Client?: string;
    CustomPrefs?: Record<string, string | null>;
    [key: string]: unknown;
};

export type ServerThemePrefs = { mode?: string; seed?: string };

function prefsPath(userId: string): string {
    return `/DisplayPreferences/usersettings?userId=${encodeURIComponent(userId)}&client=${CLIENT}`;
}

/** Preferencia remota, o null si no hay sesión / nunca se guardó nada. */
export async function getServerThemePrefs(): Promise<ServerThemePrefs | null> {
    const session = loadSession();
    if (!session?.userId) return null;
    const prefs = await apiFetch<DisplayPrefs>(prefsPath(session.userId));
    const custom = prefs.CustomPrefs ?? {};
    return {
        mode: custom.themeMode || undefined,
        seed: custom.themeSeed || undefined
    };
}

/**
 * Sube la preferencia local. Lee-modifica-escribe el objeto completo para
 * no perder otras CustomPrefs que pudieran existir bajo el mismo client.
 */
export async function saveServerThemePrefs(
    theme: { mode: string; seed: string | null }
): Promise<void> {
    const session = loadSession();
    if (!session?.userId) return;
    const path = prefsPath(session.userId);
    const current = await apiFetch<DisplayPrefs>(path).catch((): DisplayPrefs => ({}));
    const body: DisplayPrefs = {
        ...current,
        Id: current.Id ?? 'usersettings',
        Client: CLIENT,
        CustomPrefs: {
            ...(current.CustomPrefs ?? {}),
            themeMode: theme.mode,
            themeSeed: theme.seed ?? ''
        }
    };
    await apiSend(path, 'POST', body);
}
