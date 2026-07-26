import type { Api } from '@jellyfin/sdk';
import type { EndPointInfo } from '@jellyfin/sdk/lib/generated-client/models/end-point-info';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';

/**
 * Where the client sits relative to the server (same network, same machine).
 *
 * The answer decides the streaming bitrate cap, and it is needed on every
 * playback, but it cannot change while the page is open — so it is fetched
 * once per server and kept. The legacy ApiClient cached it the same way.
 */
const cache = new Map<string, EndPointInfo>();

/** Cached endpoint info, or undefined if it has not been fetched yet. */
export function getSavedEndpointInfo(api: Api | undefined): EndPointInfo | undefined {
    return api ? cache.get(api.basePath) : undefined;
}

/** Endpoint info, fetching it the first time it is asked for. */
export async function getEndpointInfo(api: Api): Promise<EndPointInfo> {
    const cached = cache.get(api.basePath);
    if (cached) return cached;

    const { data } = await getSystemApi(api).getEndpointInfo();
    cache.set(api.basePath, data);
    return data;
}

/** Drops the cached info; the next request fetches it again. */
export function clearEndpointInfo(api?: Api): void {
    if (api) {
        cache.delete(api.basePath);
    } else {
        cache.clear();
    }
}
