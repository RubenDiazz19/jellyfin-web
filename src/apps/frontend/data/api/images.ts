// Image URL helpers. All go through the server /Items/:id/Images/... endpoint.

import { loadSession } from '../session/session';
import { trimSlash } from './http';

export type ImageType = 'Primary' | 'Backdrop' | 'Logo' | 'Thumb';

export function imageUrl(
    itemId: string | undefined,
    type: ImageType,
    opts: { tag?: string; maxHeight?: number; maxWidth?: number; index?: number } = {}
): string | undefined {
    if (!itemId) return undefined;
    const session = loadSession();
    if (!session?.serverUrl) return undefined;
    const q = new URLSearchParams();
    if (opts.tag) q.set('tag', opts.tag);
    if (opts.maxHeight) q.set('maxHeight', String(opts.maxHeight));
    if (opts.maxWidth) q.set('maxWidth', String(opts.maxWidth));
    // webp reduce el peso ~50-70% frente al jpeg que sirve por defecto.
    // Todos los navegadores que soportan el resto del frontend (:has, clip)
    // decodifican webp, así que no hace falta feature-detect.
    q.set('format', 'webp');
    const qs = q.toString();
    // With no index → default Primary/Backdrop/… (index 0). With index →
    // pick that one (needed to iterate over multiple backdrops).
    const path = opts.index != null ? `${type}/${opts.index}` : type;
    return `${trimSlash(session.serverUrl)}/Items/${itemId}/Images/${path}?${qs}`;
}

// URLs for every backdrop of the item, for hero rotation.
export function getItemBackdrops(itemId: string, tags: string[] = []): string[] {
    const session = loadSession();
    if (!session?.serverUrl) return [];
    const base = trimSlash(session.serverUrl);
    return tags.length > 0 ?
        tags.map(
            (tag, i) => `${base}/Items/${itemId}/Images/Backdrop/${i}?tag=${tag}&maxWidth=2560&format=webp`
        ) :
        [`${base}/Items/${itemId}/Images/Backdrop/0?maxWidth=2560&format=webp`];
}
