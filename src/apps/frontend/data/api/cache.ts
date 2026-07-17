// In-memory show cache shared by every module that mutates or invalidates
// a show. Kept internal to the API layer.

import type { Show } from '../models';

export const showCache = new Map<string, Promise<Show>>();

export function clearShowCache(): void {
    showCache.clear();
}

export function invalidateShow(itemId: string): void {
    showCache.delete(itemId);
}
