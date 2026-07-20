// Playlists y colecciones: listar, crear y añadir items. Sustituye a los
// enlaces al web nativo del menú "más opciones".

import { loadSession } from '../session/session';
import { apiFetch, apiSend } from './http';
import { imageUrl } from './images';

export type ListEntry = {
    id: string;
    name: string;
    count?: number;
    image?: string;
};

function mapEntry(i: any): ListEntry {
    return {
        id: i.Id,
        name: i.Name,
        count: i.ChildCount,
        image: i.ImageTags?.Primary ?
            imageUrl(i.Id, 'Primary', { tag: i.ImageTags.Primary, maxHeight: 200 }) ?? undefined :
            undefined
    };
}

export async function getPlaylists(): Promise<ListEntry[]> {
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    const data = await apiFetch<{ Items: any[] }>(
        `/Users/${session.userId}/Items?IncludeItemTypes=Playlist&Recursive=true&SortBy=SortName&Fields=ChildCount`
    );
    return (data.Items ?? []).map(mapEntry);
}

export async function addToPlaylist(playlistId: string, itemId: string): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    await apiSend(`/Playlists/${playlistId}/Items?ids=${itemId}&userId=${session.userId}`, 'POST');
}

export async function createPlaylist(name: string, itemId: string): Promise<void> {
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    await apiSend('/Playlists', 'POST', {
        Name: name,
        Ids: [itemId],
        UserId: session.userId,
        MediaType: 'Video'
    });
}

export async function getCollections(): Promise<ListEntry[]> {
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    const data = await apiFetch<{ Items: any[] }>(
        `/Users/${session.userId}/Items?IncludeItemTypes=BoxSet&Recursive=true&SortBy=SortName&Fields=ChildCount`
    );
    return (data.Items ?? []).map(mapEntry);
}

export async function addToCollection(collectionId: string, itemId: string): Promise<void> {
    await apiSend(`/Collections/${collectionId}/Items?ids=${itemId}`, 'POST');
}

export async function createCollection(name: string, itemId: string): Promise<void> {
    await apiSend(`/Collections?name=${encodeURIComponent(name)}&ids=${itemId}`, 'POST');
}
