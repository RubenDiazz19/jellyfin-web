// In-memory show cache shared by every module that mutates or invalidates
// a show. Kept internal to the API layer.

import type { Show } from '../models';

export const showCache = new Map<string, Promise<Show>>();

// showCache se rellena desde shows.ts; sonar solo ve este fichero.
export function clearShowCache(): void {
    showCache.clear(); // eslint-disable-line sonarjs/no-empty-collection
}

export function invalidateShow(itemId: string): void {
    showCache.delete(itemId); // eslint-disable-line sonarjs/no-empty-collection
}
