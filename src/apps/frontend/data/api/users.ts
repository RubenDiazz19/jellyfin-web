// User settings: configuration (audio/subtitle preferences), password,
// avatar, views and (admin) user listing. Powers the custom Ajustes page so
// the native web UI isn't needed for day-to-day preferences.

import { loadSession } from '../session/session';
import { apiFetch, apiSend, noSessionError, trimSlash, uploadImage } from './http';
import { firstImageUrl } from './itemMapping';

export type SubtitleMode = 'Default' | 'Always' | 'OnlyForced' | 'None' | 'Smart';

export type UserConfig = {
    AudioLanguagePreference?: string;
    PlayDefaultAudioTrack: boolean;
    SubtitleLanguagePreference: string;
    SubtitleMode: SubtitleMode;
    DisplayMissingEpisodes: boolean;
    HidePlayedInLatest: boolean;
    RememberAudioSelections: boolean;
    RememberSubtitleSelections: boolean;
    EnableNextEpisodeAutoPlay: boolean;
    [key: string]: unknown;
};

/** El usuario tal cual lo devuelve /Users/Me y /Users (solo lo que se lee). */
type JFUser = {
    Id: string;
    Name: string;
    HasPassword?: boolean;
    LastLoginDate?: string;
    LastActivityDate?: string;
    PrimaryImageTag?: string;
    Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean };
    Configuration?: Partial<UserConfig>;
};

/** Una biblioteca del usuario tal cual la devuelve /Users/{id}/Views. */
type JFUserView = {
    Id: string;
    Name: string;
    CollectionType?: string;
    ImageTags?: Record<string, string>;
};

/**
 * Valores por defecto del servidor. Hacen falta porque `UserConfig` declara
 * esos campos como obligatorios y el servidor puede no enviarlos: antes se
 * devolvía `{}` tal cual y el `any` tapaba que la promesa no se cumplía —
 * quien leyera `config.SubtitleMode` se encontraba `undefined`.
 */
const DEFAULT_USER_CONFIG: UserConfig = {
    PlayDefaultAudioTrack: true,
    SubtitleLanguagePreference: '',
    SubtitleMode: 'Default',
    DisplayMissingEpisodes: false,
    HidePlayedInLatest: true,
    RememberAudioSelections: true,
    RememberSubtitleSelections: true,
    EnableNextEpisodeAutoPlay: true
};

function withDefaults(config: Partial<UserConfig> | undefined): UserConfig {
    return { ...DEFAULT_USER_CONFIG, ...config };
}

export type CurrentUser = {
    id: string;
    name: string;
    isAdmin: boolean;
    hasPassword: boolean;
    lastLogin?: string;
    avatarTag?: string;
    config: UserConfig;
};

export async function getCurrentUser(): Promise<CurrentUser> {
    const data = await apiFetch<JFUser>('/Users/Me');
    return {
        id: data.Id,
        name: data.Name,
        isAdmin: !!data.Policy?.IsAdministrator,
        hasPassword: !!data.HasPassword,
        lastLogin: data.LastLoginDate,
        avatarTag: data.PrimaryImageTag,
        config: withDefaults(data.Configuration)
    };
}

/**
 * Actualiza la configuración del usuario. El endpoint sustituye el objeto
 * entero, así que siempre se parte de la configuración vigente y se aplica
 * el parche encima.
 */
export async function updateUserConfig(patch: Partial<UserConfig>): Promise<UserConfig> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const current = (await apiFetch<JFUser>('/Users/Me')).Configuration;
    const merged: UserConfig = { ...withDefaults(current), ...patch };
    await apiSend(`/Users/${session.userId}/Configuration`, 'POST', merged);
    return merged;
}

export async function changePassword(currentPw: string, newPw: string): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    await apiSend(`/Users/${session.userId}/Password`, 'POST', {
        CurrentPw: currentPw,
        NewPw: newPw
    });
}

export function avatarUrl(tag?: string): string {
    const session = loadSession();
    if (!session?.userId || !session.serverUrl) return '';
    const q = tag ? `?tag=${tag}` : '';
    return `${trimSlash(session.serverUrl)}/Users/${session.userId}/Images/Primary${q}`;
}

export async function uploadAvatar(file: File): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    await uploadImage(`/Users/${session.userId}/Images/Primary`, file);
}

export async function deleteAvatar(): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    await apiSend(`/Users/${session.userId}/Images/Primary`, 'DELETE');
}

export type UserView = {
    id: string;
    name: string;
    collectionType?: string;
    image?: string;
};

export async function getUserViews(): Promise<UserView[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items: JFUserView[] }>(`/Users/${session.userId}/Views`);
    return (data.Items ?? []).map((v) => ({
        id: v.Id,
        name: v.Name,
        collectionType: v.CollectionType,
        image: firstImageUrl([['Primary', v.Id, v.ImageTags?.Primary]], { maxWidth: 600 })
    }));
}

export type UserListEntry = {
    id: string;
    name: string;
    isAdmin: boolean;
    isDisabled: boolean;
    lastActivity?: string;
};

/** Listado de usuarios del servidor (requiere admin; 403 si no lo es). */
export async function getUsers(): Promise<UserListEntry[]> {
    const data = await apiFetch<JFUser[]>('/Users');
    return (data ?? []).map((u) => ({
        id: u.Id,
        name: u.Name,
        isAdmin: !!u.Policy?.IsAdministrator,
        isDisabled: !!u.Policy?.IsDisabled,
        lastActivity: u.LastActivityDate
    }));
}
