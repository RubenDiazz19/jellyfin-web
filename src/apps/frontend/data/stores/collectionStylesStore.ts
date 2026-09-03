// Estilos personalizados para colecciones (color de fondo, etc.).
//
// Permite que cada franquicia/colección tenga una identidad visual propia
// (ej. rojo Marvel, azul Star Wars, o el color elegido por el usuario).
// Es persistente en localStorage para conservarse entre sesiones y ligero
// para no requerir peticiones de red al pintar las tarjetas.

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

function read(): StylesMap {
    if (typeof localStorage === 'undefined') return {};
    try {
        return (JSON.parse(localStorage.getItem(KEY) || '{}') ?? {}) as StylesMap;
    } catch {
        return {};
    }
}

function write(map: StylesMap): void {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(KEY, JSON.stringify(map));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(EVENT));
        }
    } catch {
        // En modo incógnito o cuota llena, no se rompe la ejecución.
    }
}

export const COLLECTION_STYLES = {
    event: EVENT,

    get(collectionId: string): CollectionStyle {
        return read()[collectionId] ?? {};
    },

    getColor(collectionId: string): string | undefined {
        return read()[collectionId]?.backgroundColor;
    },

    setColor(collectionId: string, color: string | undefined): void {
        const map = read();
        const trimmed = color?.trim();
        if (!trimmed) {
            delete map[collectionId];
        } else {
            map[collectionId] = { ...map[collectionId], backgroundColor: trimmed };
        }
        write(map);
    },

    getBackdrop(collectionId: string): string | undefined {
        return activePreviews.get(collectionId)?.backdrop ?? read()[collectionId]?.customBackdrop;
    },

    setBackdrop(collectionId: string, url: string | undefined): void {
        const map = read();
        if (!url) {
            if (map[collectionId]) delete map[collectionId].customBackdrop;
        } else {
            map[collectionId] = { ...map[collectionId], customBackdrop: url };
        }
        write(map);
    },

    getLogo(collectionId: string): string | undefined {
        return activePreviews.get(collectionId)?.logo ?? read()[collectionId]?.customLogo;
    },

    setLogo(collectionId: string, url: string | undefined): void {
        const map = read();
        if (!url) {
            if (map[collectionId]) delete map[collectionId].customLogo;
        } else {
            map[collectionId] = { ...map[collectionId], customLogo: url };
        }
        write(map);
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
        const map = read();
        map[collectionId] = { ...map[collectionId], imageVersion: Date.now() };
        write(map);
    },

    getVersion(collectionId: string): number {
        return read()[collectionId]?.imageVersion ?? 0;
    },

    getOrder(collectionId: string): string[] | undefined {
        return read()[collectionId]?.itemOrder;
    },

    setOrder(collectionId: string, order: string[]): void {
        const map = read();
        map[collectionId] = { ...map[collectionId], itemOrder: order };
        write(map);
    },

    clear(collectionId: string): void {
        const map = read();
        delete map[collectionId];
        activePreviews.delete(collectionId);
        write(map);
    },

    /** Solo para tests. */
    _reset(): void {
        activePreviews.clear();
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(KEY);
        }
    }
};
