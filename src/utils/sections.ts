import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';

import { CardShape } from 'components/cardbuilder/utils/shape';
import { ItemAction } from 'constants/itemAction';
import * as userSettings from 'scripts/settings/userSettings';
import { type Section, SectionType, SectionApiMethod } from 'types/sections';

export const getSuggestionSections = (): Section[] => {
    const parametersOptions = {
        fields: [ItemFields.PrimaryImageAspectRatio],
        filters: [ItemFilter.IsPlayed],
        IsPlayed: true,
        imageTypeLimit: 1,
        enableImageTypes: [
            ImageType.Primary,
            ImageType.Backdrop,
            ImageType.Thumb
        ]
    };
    return [
        {
            name: 'HeaderContinueWatching',
            apiMethod: SectionApiMethod.ResumeItems,
            itemTypes: 'Movie,Series',
            type: SectionType.ContinueWatchingMixed,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Series]
            },
            cardOptions: {
                overlayPlayButton: true,
                preferThumb: true,
                shape: CardShape.BackdropOverflow,
                showYear: true
            }
        },
        {
            name: 'HeaderContinueWatching',
            apiMethod: SectionApiMethod.ResumeItems,
            itemTypes: 'Movie',
            type: SectionType.ContinueWatchingMovies,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.Movie]
            },
            cardOptions: {
                overlayPlayButton: true,
                preferThumb: true,
                shape: CardShape.BackdropOverflow,
                showYear: true
            }
        },
        {
            name: 'HeaderContinueReading',
            apiMethod: SectionApiMethod.ResumeItems,
            itemTypes: 'Book',
            type: SectionType.ContinueReading,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.Book]
            },
            cardOptions: {
                overlayPlayButton: true,
                shape: CardShape.PortraitOverflow
            }
        },
        {
            name: 'HeaderLatestBooks',
            apiMethod: SectionApiMethod.LatestMedia,
            itemTypes: 'Book',
            type: SectionType.LatestBooks,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.AudioBook, BaseItemKind.Book]
            },
            cardOptions: {
                overlayPlayButton: true,
                shape: CardShape.PortraitOverflow
            }
        },
        {
            name: 'HeaderLatestMedia',
            apiMethod: SectionApiMethod.LatestMedia,
            itemTypes: 'Movie,Series',
            type: SectionType.LatestMixed,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Series]
            },
            cardOptions: {
                overlayPlayButton: true,
                shape: CardShape.PortraitOverflow,
                showYear: true
            }
        },
        {
            name: 'HeaderLatestMovies',
            apiMethod: SectionApiMethod.LatestMedia,
            itemTypes: 'Movie',
            type: SectionType.LatestMovies,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.Movie]
            },
            cardOptions: {
                overlayPlayButton: true,
                shape: CardShape.PortraitOverflow,
                showYear: true
            }
        },
        {
            name: 'HeaderContinueWatching',
            apiMethod: SectionApiMethod.ResumeItems,
            itemTypes: 'Episode',
            type: SectionType.ContinueWatchingEpisode,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.Episode]
            },
            cardOptions: {
                overlayPlayButton: true,
                shape: CardShape.BackdropOverflow,
                preferThumb: true,
                inheritThumb:
                    !userSettings.useEpisodeImagesInNextUpAndResume(undefined),
                showYear: true
            }
        },
        {
            name: 'HeaderLatestEpisodes',
            apiMethod: SectionApiMethod.LatestMedia,
            itemTypes: 'Episode',
            type: SectionType.LatestEpisode,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.Episode]
            },
            cardOptions: {
                overlayPlayButton: true,
                shape: CardShape.BackdropOverflow,
                preferThumb: true,
                showSeriesYear: true,
                showParentTitle: true,
                showUnplayedIndicator: false,
                showChildCountIndicator: true,
                lines: 2
            }
        },
        {
            name: 'NextUp',
            apiMethod: SectionApiMethod.NextUp,
            itemTypes: 'nextup',
            type: SectionType.NextUp,
            cardOptions: {
                overlayPlayButton: true,
                shape: CardShape.BackdropOverflow,
                preferThumb: true,
                inheritThumb:
                    !userSettings.useEpisodeImagesInNextUpAndResume(undefined),
                showParentTitle: true
            }
        },
        {
            name: 'HeaderLatestMusic',
            apiMethod: SectionApiMethod.LatestMedia,
            itemTypes: 'Audio',
            type: SectionType.LatestMusic,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.Audio]
            },
            cardOptions: {
                showUnplayedIndicator: false,
                shape: CardShape.SquareOverflow,
                showParentTitle: true,
                overlayPlayButton: true,
                coverImage: true
            }
        },
        {
            name: 'HeaderRecentlyPlayed',
            itemTypes: 'Audio',
            type: SectionType.RecentlyPlayedMusic,
            parametersOptions: {
                sortBy: [ItemSortBy.DatePlayed],
                sortOrder: [SortOrder.Descending],
                includeItemTypes: [BaseItemKind.Audio],
                ...parametersOptions
            },
            cardOptions: {
                showUnplayedIndicator: false,
                shape: CardShape.SquareOverflow,
                showParentTitle: true,
                action: ItemAction.InstantMix,
                overlayMoreButton: true,
                coverImage: true
            }
        },
        {
            name: 'HeaderFrequentlyPlayed',
            itemTypes: 'Audio',
            type: SectionType.FrequentlyPlayedMusic,
            parametersOptions: {
                sortBy: [ItemSortBy.PlayCount],
                sortOrder: [SortOrder.Descending],
                includeItemTypes: [BaseItemKind.Audio],
                ...parametersOptions
            },
            cardOptions: {
                showUnplayedIndicator: false,
                shape: CardShape.SquareOverflow,
                showParentTitle: true,
                action: ItemAction.InstantMix,
                overlayMoreButton: true,
                coverImage: true
            }
        },
        {
            name: 'HeaderLatestMusicVideos',
            apiMethod: SectionApiMethod.LatestMedia,
            itemTypes: 'Video',
            type: SectionType.LatestMusicVideos,
            parametersOptions: {
                includeItemTypes: [BaseItemKind.MusicVideo]
            },
            cardOptions: {
                showUnplayedIndicator: false,
                shape: CardShape.BackdropOverflow,
                showParentTitle: true,
                overlayPlayButton: true,
                coverImage: true
            }
        },
        {
            name: 'HeaderRecentlyPlayed',
            itemTypes: 'Video',
            type: SectionType.RecentlyPlayedMusicVideos,
            parametersOptions: {
                sortBy: [ItemSortBy.DatePlayed],
                sortOrder: [SortOrder.Descending],
                includeItemTypes: [BaseItemKind.MusicVideo],
                ...parametersOptions
            },
            cardOptions: {
                showUnplayedIndicator: false,
                shape: CardShape.BackdropOverflow,
                showParentTitle: true,
                overlayMoreButton: true,
                coverImage: true
            }
        },
        {
            name: 'HeaderFrequentlyPlayed',
            itemTypes: 'Video',
            type: SectionType.FrequentlyPlayedMusicVideos,
            parametersOptions: {
                sortBy: [ItemSortBy.PlayCount],
                sortOrder: [SortOrder.Descending],
                includeItemTypes: [BaseItemKind.MusicVideo],
                ...parametersOptions
            },
            cardOptions: {
                showUnplayedIndicator: false,
                shape: CardShape.BackdropOverflow,
                showParentTitle: true,
                overlayMoreButton: true,
                coverImage: true
            }
        }
    ];
};

