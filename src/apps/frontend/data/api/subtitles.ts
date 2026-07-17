// Remote subtitle search + download (OpenSubtitles etc., configured on server).

import { invalidateShow } from './cache';
import { apiSend } from './http';

export type RemoteSubtitle = {
    Id: string;
    Name: string;
    Format?: string;
    Language?: string;
    ProviderName?: string;
    Comment?: string;
};

export async function searchSubtitles(itemId: string, language: string): Promise<RemoteSubtitle[]> {
    const res = await apiSend(`/Items/${itemId}/RemoteSearch/Subtitles/${language}`, 'POST', {});
    return res.json();
}

export async function downloadSubtitle(itemId: string, subtitleId: string): Promise<void> {
    await apiSend(
        `/Items/${itemId}/RemoteSearch/Subtitles/${encodeURIComponent(subtitleId)}`,
        'POST',
        {}
    );
    invalidateShow(itemId);
}
