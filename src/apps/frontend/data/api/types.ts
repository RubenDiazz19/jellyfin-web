// Internal Jellyfin server DTOs. Kept private to the API layer — presentation
// consumes the domain models re-exported from data/models.

/**
 * Pista de un MediaSource, tal cual la manda el servidor.
 *
 * Declaración única para todo el API layer. Antes vivía también en
 * `playback.ts` con una forma incompatible —allí `Index` era obligatorio y
 * `Type` un `string` libre; aquí no había `Index` y `Type` era una unión
 * cerrada— así que una pista sacada de un módulo no se podía pasar al otro
 * sin castear, pese a venir las dos del mismo JSON.
 */
export type JFMediaStream = {
    Index: number;
    Type?: string;
    Codec?: string;
    Width?: number;
    Height?: number;
    VideoRangeType?: string;
    ChannelLayout?: string;
    Channels?: number;
    Language?: string;
    Title?: string;
    DisplayTitle?: string;
    IsDefault?: boolean;
    IsForced?: boolean;
};

export type JFMediaSource = {
    Container?: string;
    Size?: number;
    MediaStreams?: JFMediaStream[];
};

export type JFItem = {
    Id: string;
    Name: string;
    IndexNumber?: number;
    ParentIndexNumber?: number;
    SeriesId?: string;
    SeriesName?: string;
    SeriesPrimaryImageTag?: string;
    ParentBackdropItemId?: string;
    ParentBackdropImageTags?: string[];
    ParentLogoItemId?: string;
    ParentLogoImageTag?: string;
    ProductionYear?: number;
    Overview?: string;
    Genres?: string[];
    Studios?: { Name: string }[];
    People?: {
        Name: string;
        Role?: string;
        Type: string;
        Id?: string;
        PrimaryImageTag?: string;
    }[];
    CommunityRating?: number;
    OfficialRating?: string;
    Taglines?: string[];
    /** Etiquetas libres del item. Viven en el servidor: se ven desde cualquier cliente. */
    Tags?: string[];
    ImageTags?: Record<string, string>;
    BackdropImageTags?: string[];
    RunTimeTicks?: number;
    PremiereDate?: string;
    EndDate?: string;
    Status?: string;
    Container?: string;
    MediaSources?: JFMediaSource[];
    UserData?: {
        Played?: boolean;
        PlayedPercentage?: number;
        PlaybackPositionTicks?: number;
    };
};

// `Tags` hay que pedirlo explícitamente: no viene en la respuesta por
// defecto, y sin él las etiquetas se leerían siempre como lista vacía.
export const FIELDS_LIST =
    'Overview,Genres,ProductionYear,Studios,CommunityRating,OfficialRating,ImageTags,BackdropImageTags,RunTimeTicks,PremiereDate,Tags';
export const FIELDS_DETAIL = `${FIELDS_LIST},People,Taglines,EndDate,Status`;

/**
 * Campos del catálogo completo (series y películas de la biblioteca), que es
 * la respuesta más grande que pide el frontend: son TODOS los items, y de
 * cada uno la rejilla solo pinta carátula, título, año y duración.
 *
 * Frente a `FIELDS_LIST` se caen dos:
 * - `Studios`, que solo enseña la ficha, y la ficha se pide aparte con
 *   `FIELDS_DETAIL`.
 * - `BackdropImageTags`, con `EnableImageTypes` a juego: un fondo por item
 *   (varios tags de 32 caracteres cada uno) que la tarjeta nunca pinta —usa
 *   la carátula— y que en un catálogo de mil títulos son cientos de KB.
 *
 * `Overview` **se queda**: el buscador filtra por sinopsis sobre esta misma
 * lista (`SearchViewModel.matchesQuery`), así que quitarlo no sería un ahorro
 * sino perder una función.
 */
export const FIELDS_GRID =
    'Overview,Genres,ProductionYear,CommunityRating,OfficialRating,ImageTags,RunTimeTicks,PremiereDate,Tags';

/** Las dos únicas imágenes que pinta una tarjeta de la rejilla. */
export const GRID_IMAGE_TYPES = 'Primary,Logo';

/**
 * Jellyfin cuenta el tiempo en «ticks» de 100 ns.
 *
 * ÚNICA definición del repo: estaba copiada en cuatro sitios y suelta como
 * literal en otros tantos. Vive aquí, en la capa de datos, porque es una
 * unidad del servidor; `domain/player/format.ts` la reexporta para la vista,
 * que no puede importar de `data/` (regla de capas).
 */
export const TICKS_PER_SECOND = 10_000_000;

const SECONDS_PER_MINUTE = 60;

export const ticksToMinutes = (ticks?: number): number | undefined =>
    ticks ? Math.round(ticks / TICKS_PER_SECOND / SECONDS_PER_MINUTE) : undefined;

/** Ticks → minutos SIN redondear. Para cuentas que siguen operando después. */
export const ticksToExactMinutes = (ticks?: number): number =>
    (ticks ? ticks / TICKS_PER_SECOND / SECONDS_PER_MINUTE : 0);
