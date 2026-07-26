import type { Api } from '@jellyfin/sdk';
import type { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import type { ImageRequestParameters } from '@jellyfin/sdk/lib/models/api/image-request-parameters';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';

/** Parameters that make the server re-encode the image instead of serving the original. */
const SCALE_PARAMS = ['maxWidth', 'maxHeight', 'width', 'height', 'fillWidth', 'fillHeight'] as const;

/** Quality applied to re-encoded images, matching what the legacy ApiClient used. */
const SCALED_IMAGE_QUALITY = 90;

/**
 * Options accepted when building a scaled image url.
 * `index` picks one of several images of the same type (e.g. the third backdrop).
 */
export type ScaleImageOptions = ImageRequestParameters & { index?: number };

/**
 * Returns the url of an item image, scaled server side.
 *
 * Whenever the request asks the server to resize, quality drops to 90: a
 * re-encode at full quality ships a needlessly heavy image, and the legacy
 * ApiClient defaulted to the same value.
 * @param api The SDK Api instance.
 * @param itemId The item owning the image.
 * @param imageType The kind of image requested.
 * @param options Scaling parameters, plus `index` to pick a specific image.
 * @returns The image url.
 */
export function getScaledImageUrl(
    api: Api,
    itemId: string,
    imageType: ImageType,
    options: ScaleImageOptions = {}
): string {
    const { index, quality, ...params } = options;
    const isScaled = SCALE_PARAMS.some((key) => params[key] != null);

    return getImageApi(api).getItemImageUrlById(itemId, imageType, {
        ...params,
        imageIndex: index,
        quality: quality ?? (isScaled ? SCALED_IMAGE_QUALITY : undefined)
    });
}
