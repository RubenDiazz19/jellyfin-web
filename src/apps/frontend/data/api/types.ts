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

export const ticksToMinutes = (ticks?: number): number | undefined =>
    ticks ? Math.round(ticks / 10_000_000 / 60) : undefined;
