import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';

import { randomInt } from '../number';
import { getScaledImageUrl, type ScaleImageOptions } from './imageUrls';

export type { ScaleImageOptions };

/**
 * Returns the url of the first or a random backdrop image of an item.
 * If the item has no backdrop image, the url of the first or a random backdrop image of the parent item is returned.
 * Falls back to the primary image (cover) of the item, if neither the item nor it's parent have at least one backdrop image.
 * Returns undefined if no usable image was found.
 * @param api The SDK Api instance used to generate the url.
 * @param item The item for which the backdrop image is requested.
 * @param options Optional; allows to scale the backdrop image.
 * @param random If set to true and the item has more than one backdrop, a random image is returned.
 * @returns The url of the first or a random backdrop image of the provided item.
 */
export const getItemBackdropImageUrl = (api: Api, item: BaseItemDto, options: ScaleImageOptions = {}, random = false): string | undefined => {
    if (item.Id && item.BackdropImageTags?.length) {
        const backdropImgIndex = random ? randomInt(0, item.BackdropImageTags.length - 1) : 0;
        return getScaledImageUrl(api, item.Id, ImageType.Backdrop, {
            ...options,
            index: backdropImgIndex,
            tag: item.BackdropImageTags[backdropImgIndex]
        });
    } else if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) {
        const backdropImgIndex = random ? randomInt(0, item.ParentBackdropImageTags.length - 1) : 0;
        return getScaledImageUrl(api, item.ParentBackdropItemId, ImageType.Backdrop, {
            ...options,
            index: backdropImgIndex,
            tag: item.ParentBackdropImageTags[backdropImgIndex]
        });
    } else if (item.Id && item.ImageTags?.Primary) {
        return getScaledImageUrl(api, item.Id, ImageType.Primary, {
            ...options,
            tag: item.ImageTags.Primary
        });
    }
    return undefined;
};
