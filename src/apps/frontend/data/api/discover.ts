// Las consultas que devuelven un recorte del catálogo con series y películas
// mezcladas: un género, la filmografía de una persona, el «más como esto» de
// una ficha y lo que encaja con un texto.
//
// Todas devuelven lo mismo —un puñado de items de dos tipos— y se diferencian
// solo en el filtro, así que comparten el reparto por tipo. Antes estas
// pantallas recorrían el catálogo en memoria del navegador: solo veían lo que
// ya se hubiera cargado, y nada si no se había cargado todavía.

import type { Movie, Show } from '../models';
import { loadSession } from '../session/session';
import { apiFetch, fetchUserItems, noSessionError } from './http';
import { mapMovie } from './movies';
import { mapShow } from './shows';
import { FIELDS_LIST, type JFItem } from './types';

/** Un recorte del catálogo ya separado por tipo, que es como lo pintan. */
export type CatalogSlice = { shows: Show[]; movies: Movie[] };

type JFTypedItem = JFItem & { Type?: string };

/** Cuántos «más como esto» caben en la fila sin obligar a scrollear. */
const SIMILAR_LIMIT = 8;

/** Tope de resultados que se le piden al buscador del servidor. */
const SEARCH_LIMIT = 24;

const CATALOG_QUERY = `Recursive=true&IncludeItemTypes=Series,Movie&SortBy=SortName&Fields=${FIELDS_LIST}`;

function splitByType(items: JFTypedItem[]): CatalogSlice {
    return {
        shows: items.filter((i) => i.Type === 'Series').map(mapShow),
        movies: items.filter((i) => i.Type === 'Movie').map(mapMovie)
    };
}

/** Series y películas de un género. */
export async function getByGenre(genre: string): Promise<CatalogSlice> {
    return splitByType(await fetchUserItems<JFTypedItem>(
        `${CATALOG_QUERY}&Genres=${encodeURIComponent(genre)}`
    ));
}

/**
 * Filmografía de una persona dentro de la biblioteca.
 *
 * Se filtra por nombre y no por id porque el nombre es lo que viaja en la URL
 * de la ficha (`/person/<nombre>`), que es lo que se comparte y se guarda en
 * marcadores. `People` se pide aparte de los campos habituales: la ficha saca
 * de ahí el retrato y el papel, y no viene en la respuesta por defecto.
 */
export async function getByPerson(name: string): Promise<CatalogSlice> {
    return splitByType(await fetchUserItems<JFTypedItem>(
        `${CATALOG_QUERY},People&Person=${encodeURIComponent(name)}`
    ));
}

/**
 * «Más como esto». Lo decide el servidor cruzando géneros, estudio, reparto y
 * etiquetas, y mirando la biblioteca entera — no solo lo que este navegador
 * hubiera cargado, que es lo que limitaba a la versión anterior.
 */
export async function getSimilar(itemId: string): Promise<CatalogSlice> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items: JFTypedItem[] }>(
        `/Items/${itemId}/Similar?userId=${session.userId}&limit=${SIMILAR_LIMIT}&Fields=${FIELDS_LIST}`
    );
    return splitByType(data.Items ?? []);
}

type JFSearchHint = { Id?: string; ItemId?: string };

/**
 * Lo que el buscador del servidor encuentra para un texto.
 *
 * Son dos peticiones a propósito. `/Search/Hints` es quien sabe buscar de
 * verdad —ignora acentos y mayúsculas, ordena por relevancia y llega a toda la
 * biblioteca, no solo a lo que este navegador se haya traído—, pero devuelve
 * una ficha mínima: sin géneros, sin etiquetas, sin progreso ni logo. Con eso
 * las tarjetas saldrían a medias y los filtros de la búsqueda dejarían fuera lo
 * que no supieran mirar. La segunda petición trae esos mismos items completos,
 * idénticos a los del resto del catálogo.
 */
export async function searchCatalog(term: string): Promise<CatalogSlice> {
    const query = term.trim();
    const empty: CatalogSlice = { shows: [], movies: [] };
    if (!query) return empty;

    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const hints = await apiFetch<{ SearchHints?: JFSearchHint[] }>(
        `/Search/Hints?userId=${session.userId}&searchTerm=${encodeURIComponent(query)}`
        + `&includeItemTypes=Series,Movie&limit=${SEARCH_LIMIT}`
    );
    // `ItemId` es el campo viejo, marcado como deprecado pero aún servido:
    // se mira por si el servidor es anterior al que renombró el campo.
    const ids = (hints.SearchHints ?? [])
        .map((h) => h.Id || h.ItemId)
        .filter((id): id is string => !!id);
    if (ids.length === 0) return empty;

    const items = await fetchUserItems<JFTypedItem>(
        `Ids=${ids.join(',')}&Fields=${FIELDS_LIST}`
    );
    // El orden lo pone el buscador, no el listado: pedir por `Ids` devuelve en
    // el orden que quiera el servidor y ahí se perdería el ranking.
    const rank = new Map(ids.map((id, i) => [id, i]));
    items.sort((a, b) => (rank.get(a.Id) ?? 0) - (rank.get(b.Id) ?? 0));
    return splitByType(items);
}
