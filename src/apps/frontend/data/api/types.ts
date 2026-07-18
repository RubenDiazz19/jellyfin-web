// Internal Jellyfin server DTOs. Kept private to the API layer — presentation
// consumes the domain models re-exported from data/models.

export type JFMediaStream = {
    Type: 'Video' | 'Audio' | 'Subtitle';
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

export const FIELDS_LIST =
    'Overview,Genres,ProductionYear,Studios,CommunityRating,OfficialRating,ImageTags,BackdropImageTags,RunTimeTicks,PremiereDate';
export const FIELDS_DETAIL = `${FIELDS_LIST},People,Taglines,EndDate,Status`;

export const ticksToMinutes = (ticks?: number): number | undefined =>
    ticks ? Math.round(ticks / 10_000_000 / 60) : undefined;
