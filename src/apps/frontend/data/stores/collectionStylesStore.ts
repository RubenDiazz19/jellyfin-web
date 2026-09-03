// Estilos personalizados para colecciones (color de fondo, etc.).
//
// Permite que cada franquicia/colección tenga una identidad visual propia
// (ej. rojo Marvel, azul Star Wars, o el color elegido por el usuario).
// Es persistente en localStorage para conservarse entre sesiones y ligero
// para no requerir peticiones de red al pintar las tarjetas.

import { createKVStore } from './persistentStore';

const KEY = 'jfp-collection-styles';
const EVENT = 'jfp-collection-styles-change';

export type CollectionStyle = {
    backgroundColor?: string;
    customBackdrop?: string;
    customLogo?: string;
    imageVersion?: number;
    itemOrder?: string[];
};

type StylesMap = Record<string, CollectionStyle>;

// Previews volátiles en memoria para feedback instantáneo (Blob URLs)
const activePreviews = new Map<string, { backdrop?: string; logo?: string }>();

const store = createKVStore<StylesMap>({
    key: KEY,
    event: EVENT,
    parse: (raw) => (raw && typeof raw === 'object' ? (raw as StylesMap) : {}),
    fallback: () => ({})
});

export const COLLECTION_STYLES = {
    event: EVENT,

    get(collectionId: string): CollectionStyle {
        return store.get()[collectionId] ?? {};
    },

    getColor(collectionId: string): string | undefined {
        return store.get()[collectionId]?.backgroundColor;
    },

    setColor(collectionId: string, color: string | undefined): void {
        const trimmed = color?.trim();
        store.update((map) => {
            const next = { ...map };
            if (!trimmed) {
                delete next[collectionId];
            } else {
                next[collectionId] = { ...next[collectionId], backgroundColor: trimmed };
            }
            return next;
        });
    },

    getBackdrop(collectionId: string): string | undefined {
        return activePreviews.get(collectionId)?.backdrop ?? store.get()[collectionId]?.customBackdrop;
    },

    setBackdrop(collectionId: string, url: string | undefined): void {
        store.update((map) => {
            const next = { ...map };
            if (!url) {
                if (next[collectionId]) {
                    const current = { ...next[collectionId] };
                    delete current.customBackdrop;
                    next[collectionId] = current;
                }
            } else {
                next[collectionId] = { ...next[collectionId], customBackdrop: url };
            }
            return next;
        });
    },

    getLogo(collectionId: string): string | undefined {
        return activePreviews.get(collectionId)?.logo ?? store.get()[collectionId]?.customLogo;
    },

    setLogo(collectionId: string, url: string | undefined): void {
        store.update((map) => {
            const next = { ...map };
            if (!url) {
                if (next[collectionId]) {
                    const current = { ...next[collectionId] };
                    delete current.customLogo;
                    next[collectionId] = current;
                }
            } else {
                next[collectionId] = { ...next[collectionId], customLogo: url };
            }
            return next;
        });
    },

    setPreview(collectionId: string, type: 'Backdrop' | 'Logo' | 'Primary', url: string): void {
        const prev = activePreviews.get(collectionId) ?? {};
        if (type === 'Logo') {
            prev.logo = url;
        } else {
            prev.backdrop = url;
        }
        activePreviews.set(collectionId, prev);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(EVENT));
        }
    },

    touch(collectionId: string): void {
        store.update((map) => ({
            ...map,
            [collectionId]: { ...map[collectionId], imageVersion: Date.now() }
        }));
    },

    getVersion(collectionId: string): number {
        return store.get()[collectionId]?.imageVersion ?? 0;
    },

    getOrder(collectionId: string): string[] | undefined {
        return store.get()[collectionId]?.itemOrder;
    },

    setOrder(collectionId: string, order: string[]): void {
        store.update((map) => ({
            ...map,
            [collectionId]: { ...map[collectionId], itemOrder: order }
        }));
    },

    clear(collectionId: string): void {
        activePreviews.delete(collectionId);
        store.update((map) => {
            const next = { ...map };
            delete next[collectionId];
            return next;
        });
    },

    /** Solo para tests. */
    _reset(): void {
        activePreviews.clear();
        store._reset();
    }
};
