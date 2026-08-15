// Candidatos a foto de perfil: el tipo común que devuelven todas las fuentes
// (la biblioteca local, AniList, TMDB), la fuente que no necesita salir de
// casa —el reparto de las series y películas del propio servidor— y la
// composición de la imagen final con su color de fondo.
//
// OJO: los candidatos se etiquetan con el PERSONAJE (el papel, `Role`), no
// con el intérprete — es lo que se quiere para un avatar. Por eso la fuente
// local NO es el endpoint /Persons de Jellyfin (devuelve intérpretes sin su
// papel), sino los items con su reparto, el mismo sitio del que `mapCast`
// saca la ficha.

import globalize from 'lib/globalize';

import { fetchUserItems } from './http';
import { imageUrl } from './images';
import type { JFItem } from './types';

/** De dónde ha salido un candidato. La vista lo usa para el badge «Anime». */
export type AvatarSource = 'library' | 'anilist' | 'tmdb';

export type AvatarCandidate = {
    /** Único por fuente: hace de key en la rejilla. */
    id: string;
    /** Nombre del personaje (no del intérprete). */
    name: string;
    /** La serie/película de la que sale, y el intérprete si se conoce. */
    subtitle: string;
    /**
     * El título del que sale; solo lo llevan los candidatos de la biblioteca.
     * Es la llave con la que `resolveSeriesArt` cruza con el índice de AniList.
     */
    series?: string;
    imageUrl: string;
    source: AvatarSource;
};

/** Cuántos items se peinan para la vista por defecto / para una búsqueda. */
const DEFAULT_ITEMS = 14;
const SEARCH_ITEMS = 8;
/** Reparto por item: con más, un solo título coparía la rejilla entera. */
const CAST_PER_ITEM = 6;
/** Tope de candidatos por consulta a la fuente local. */
const LOCAL_LIMIT = 24;
/** Alto pedido al servidor: el avatar final se compone a 512px. */
const PHOTO_HEIGHT = 512;

function charactersFromItems(items: JFItem[]): AvatarCandidate[] {
    const out: AvatarCandidate[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        const cast = (item.People ?? [])
            .filter((p) => p.Type === 'Actor')
            .slice(0, CAST_PER_ITEM);
        for (const p of cast) {
            if (!p.Id || !p.PrimaryImageTag) continue;
            // Un mismo intérprete aparece en varios items: una vez por papel.
            const key = `${p.Id}:${p.Role ?? ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const photo = imageUrl(
                p.Id, 'Primary', { tag: p.PrimaryImageTag, maxHeight: PHOTO_HEIGHT }
            );
            if (!photo) continue;
            out.push({
                id: `lib-${p.Id}-${item.Id}`,
                name: p.Role || p.Name,
                subtitle: p.Role ? `${item.Name} · ${p.Name}` : item.Name,
                series: item.Name,
                imageUrl: photo,
                source: 'library'
            });
            if (out.length >= LOCAL_LIMIT) return out;
        }
    }
    return out;
}

/**
 * La rejilla sin buscar: personajes de una muestra aleatoria de la
 * biblioteca. Aleatorio y no «recién añadidos» a propósito: con un criterio
 * estable, abrir el selector dos veces enseñaría siempre las mismas caras.
 */
export async function getLibraryCharacters(): Promise<AvatarCandidate[]> {
    const items = await fetchUserItems<JFItem>(
        'Recursive=true&IncludeItemTypes=Movie,Series&SortBy=Random'
        + `&Limit=${DEFAULT_ITEMS}&Fields=People`
    );
    return charactersFromItems(items);
}

/**
 * Personajes de los títulos que casan con el texto. El buscador de Jellyfin
 * encuentra la serie/película por su nombre; el personaje se saca después de
 * su reparto (buscar por nombre de personaje no lo soporta el servidor — de
 * eso se encargan AniList y TMDB).
 */
export async function searchLibraryCharacters(term: string): Promise<AvatarCandidate[]> {
    const items = await fetchUserItems<JFItem>(
        'Recursive=true&IncludeItemTypes=Movie,Series&SortBy=SortName'
        + `&SearchTerm=${encodeURIComponent(term)}&Limit=${SEARCH_ITEMS}&Fields=People`
    );
    return charactersFromItems(items);
}

/** Lado del avatar compuesto, en píxeles. */
const AVATAR_SIZE = 512;

/**
 * Fondo fijo de la composición. Solo se ve en los PNG con transparencia (el
 * arte de personajes de AniList lo es): con el recorte «cover» cualquier
 * imagen opaca lo cubre entero.
 */
export const AVATAR_BACKGROUND = '#16161c';

/**
 * El avatar final: la imagen elegida a sangre completa en un canvas de 512px,
 * sobre el fondo. El color se «hornea» en la imagen, así el avatar se ve
 * igual en cualquier cliente, no solo en este.
 *
 * La imagen se pide por `fetch` y se dibuja desde el blob, no con un
 * <img src>: así la CORS ya la pasó la descarga y el canvas no se contamina,
 * que es lo que haría fallar el toBlob con imágenes de otro dominio. El
 * servidor Jellyfin, el CDN de AniList y el de TMDB sirven todos con
 * `Access-Control-Allow-Origin: *`.
 *
 * `cache: 'reload'` NO es opcional: la rejilla ya ha enseñado esa misma URL
 * como tile (CSS, sin CORS) y el CDN de AniList la cachea un mes. El fetch
 * con CORS puede reutilizar esa entrada de caché, que llegó SIN cabeceras
 * CORS (la petición de la tile no lleva Origin), y la comprobación CORS falla
 * con un «Failed to fetch» sin red de por medio — solo en personajes cuyo
 * arte ya se había pintado, que es justo el caso al guardar. Forzar la red
 * hace que la petición salga con Origin y el CDN conteste las cabeceras.
 */
export async function buildAvatarFile(candidate: AvatarCandidate): Promise<File> {
    const res = await fetch(candidate.imageUrl, { cache: 'reload' });
    if (!res.ok) throw new Error(globalize.translate('AvatarPickerImageError'));
    const bitmap = await createImageBitmap(await res.blob());
    try {
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(globalize.translate('AvatarPickerImageError'));
        ctx.fillStyle = AVATAR_BACKGROUND;
        ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
        // «Cover» con sesgo hacia arriba: el avatar se muestra siempre en un
        // círculo y la composición tiene que llenarlo entero (un «contain»
        // dejaba bandas de fondo a los lados de los retratos verticales, que
        // es el formato casi universal del arte de AniList). El sesgo baja la
        // cara al centro del círculo: un centrado exacto la corta por la
        // frente, y sin sesgo (0) queda pegada al borde superior.
        const scale = Math.max(AVATAR_SIZE / bitmap.width, AVATAR_SIZE / bitmap.height);
        const w = bitmap.width * scale;
        const h = bitmap.height * scale;
        ctx.drawImage(bitmap, (AVATAR_SIZE - w) / 2, (AVATAR_SIZE - h) * 0.25, w, h);
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });
        if (!blob) throw new Error(globalize.translate('AvatarPickerImageError'));
        return new File([blob], 'avatar.png', { type: 'image/png' });
    } finally {
        bitmap.close();
    }
}
