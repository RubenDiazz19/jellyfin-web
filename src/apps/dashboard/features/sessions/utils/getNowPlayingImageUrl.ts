import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import dom from 'utils/dom';
import { getScaledImageUrl } from 'utils/sdk/imageUrls';

const getNowPlayingImageUrl = (item: BaseItemDto) => {
    if (!item.ServerId) return null;

    const api = ServerConnections.getApi(item.ServerId);
    if (!api) {
        console.error('[getNowPlayingImageUrl] No Api instance available for serverId', item.ServerId);
        return null;
    }

    /* Screen width is multiplied by 0.2, as the there is currently no way to get the width of
                elements that aren't created yet. */
    const maxWidth = Math.round(dom.getScreenWidth() * 0.20);

    if (item?.BackdropImageTags?.length && item.Id) {
        return getScaledImageUrl(api, item.Id, ImageType.Backdrop, {
            maxWidth,
            tag: item.BackdropImageTags[0]
        });
    }

    if (item?.ParentBackdropImageTags?.length && item.ParentBackdropItemId) {
        return getScaledImageUrl(api, item.ParentBackdropItemId, ImageType.Backdrop, {
            maxWidth,
            tag: item.ParentBackdropImageTags[0]
        });
    }

    const imageTags = item?.ImageTags || {};

    if (item?.Id && imageTags.Thumb) {
        return getScaledImageUrl(api, item.Id, ImageType.Thumb, {
            maxWidth,
            tag: imageTags.Thumb
        });
    }

    if (item?.ParentThumbImageTag && item.ParentThumbItemId) {
        return getScaledImageUrl(api, item.ParentThumbItemId, ImageType.Thumb, {
            maxWidth,
            tag: item.ParentThumbImageTag
        });
    }

    if (item?.Id && imageTags.Primary) {
        return getScaledImageUrl(api, item.Id, ImageType.Primary, {
            maxWidth,
            tag: imageTags.Primary
        });
    }

    if (item?.AlbumPrimaryImageTag && item.AlbumId) {
        return getScaledImageUrl(api, item.AlbumId, ImageType.Primary, {
            maxWidth,
            tag: item.AlbumPrimaryImageTag
        });
    }

    return null;
};

export default getNowPlayingImageUrl;
