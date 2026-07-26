import type { Api } from '@jellyfin/sdk';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import type { ItemDto } from 'types/base/models/item-dto';
import { getScaledImageUrl } from 'utils/sdk/imageUrls';

interface ImageOptions {
    height?: number
    maxHeight?: number
    tag?: string
    type?: ImageType
}

/** The scaling half of ImageOptions; `type` travels as its own argument. */
type ScaleOptions = Omit<ImageOptions, 'type'>;

function getSeriesImageUrl(api: Api, item: ItemDto, type: ImageType, options: ScaleOptions) {
    if (item.SeriesId && type === ImageType.Primary && item.SeriesPrimaryImageTag) {
        return getScaledImageUrl(api, item.SeriesId, ImageType.Primary, {
            ...options,
            tag: item.SeriesPrimaryImageTag
        });
    }

    if (type === ImageType.Thumb) {
        if (item.SeriesId && item.SeriesThumbImageTag) {
            return getScaledImageUrl(api, item.SeriesId, ImageType.Thumb, {
                ...options,
                tag: item.SeriesThumbImageTag
            });
        }

        if (item.ParentThumbItemId && item.ParentThumbImageTag) {
            return getScaledImageUrl(api, item.ParentThumbItemId, ImageType.Thumb, {
                ...options,
                tag: item.ParentThumbImageTag
            });
        }
    }

    return null;
}

export function getImageUrl(item: ItemDto, options: ImageOptions = {}) {
    if (!item.ServerId) return null;

    const api = ServerConnections.getApi(item.ServerId);
    if (!api) {
        console.error('[getImageUrl] No Api instance available for serverId', item.ServerId);
        return null;
    }

    const { type = ImageType.Primary, ...scaleOptions } = options;

    if (item.Type === BaseItemKind.Episode) return getSeriesImageUrl(api, item, type, scaleOptions);

    const itemId = item.PrimaryImageItemId || item.Id;

    if (itemId && item.ImageTags?.[type]) {
        return getScaledImageUrl(api, itemId, type, {
            ...scaleOptions,
            tag: item.ImageTags[type] ?? undefined
        });
    }

    if (item.AlbumId && item.AlbumPrimaryImageTag) {
        return getScaledImageUrl(api, item.AlbumId, type, {
            ...scaleOptions,
            tag: item.AlbumPrimaryImageTag
        });
    }

    return null;
}
