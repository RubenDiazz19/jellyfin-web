import type { Api } from '@jellyfin/sdk';
import type { LibraryApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import type { BaseItemDtoQueryResult } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto-query-result';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

const ITEMS_PER_REQUEST_LIMIT = 40;

function getItemsSplit(api: Api, request: LibraryApiGetItemsRequest) {
    const ids = request.ids ?? [];
    const results = [];
    const limit = request.limit ?? Infinity;

    let end;
    for (let start = 0; start < ids.length && start < limit; start = end) {
        end = start + ITEMS_PER_REQUEST_LIMIT;
        if (end > limit) {
            end = limit;
        }
        results.push(getLibraryApi(api).getItems({ ...request, ids: ids.slice(start, end) }));
    }

    return results;
}

function mergeResults(results: BaseItemDtoQueryResult[]) {
    const merged: BaseItemDtoQueryResult = {
        Items: [],
        StartIndex: 0
    };
    // set TotalRecordCount separately so TS knows it is defined
    merged.TotalRecordCount = 0;

    for (const result of results) {
        if (!result.Items) {
            console.log('[getItems] Retrieved Items array is invalid', result.Items);
            continue;
        }
        if (!result.TotalRecordCount) {
            console.log('[getItems] Retrieved TotalRecordCount is invalid', result.TotalRecordCount);
            continue;
        }
        if (typeof result.StartIndex === 'undefined') {
            console.log('[getItems] Retrieved StartIndex is invalid', result.StartIndex);
            continue;
        }
        merged.Items = merged.Items?.concat(result.Items);
        merged.TotalRecordCount += result.TotalRecordCount;
        merged.StartIndex = Math.min(merged.StartIndex || 0, result.StartIndex);
    }
    return merged;
}

/**
 * Transparently handles the call to the items endpoint, splitting it into
 * multiple ones if the URL might get too long.
 * @param api The SDK Api instance to use
 * @param request The items request. This includes a possibly long `ids` list that will be split up.
 * @returns A promise that resolves to the merged result of all requests
 */
export async function getItems(api: Api, request: LibraryApiGetItemsRequest = {}): Promise<BaseItemDtoQueryResult> {
    const ids = request.ids;
    if (!ids || ids.length <= ITEMS_PER_REQUEST_LIMIT) {
        return (await getLibraryApi(api).getItems(request)).data;
    }

    const results = await Promise.all(getItemsSplit(api, request));

    return mergeResults(results.map((result) => result.data));
}
