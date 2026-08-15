import { clearBackdrop, setBackdropImages, setBackdrops } from '../components/backdrop/backdrop';
import * as userSettings from './settings/userSettings';
import libraryMenu from './libraryMenu';
import { pageClassOn } from '../../utils/dashboard';
import { queryClient } from 'utils/query/queryClient';
import { getBrandingOptionsQuery } from 'apps/dashboard/features/branding/api/useBrandingOptions';
import { SPLASHSCREEN_URL } from 'constants/branding';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

const cache = {};

function enabled() {
    return userSettings.enableBackdrops();
}

function getBackdropItemIds(api, userId, types, parentId) {
    const key = `backdrops2_${userId + (types || '') + (parentId || '')}`;
    let data = cache[key];

    if (data) {
        console.debug(`Found backdrop id list in cache. Key: ${key}`);
        data = JSON.parse(data);
        return Promise.resolve(data);
    }

    return getLibraryApi(api).getItems({
        userId,
        sortBy: [ItemSortBy.IsFavoriteOrLiked, ItemSortBy.Random],
        limit: 20,
        recursive: true,
        // `data-backdroptype` llega como lista separada por comas.
        includeItemTypes: types ? types.split(',') : undefined,
        imageTypes: [ImageType.Backdrop],
        parentId,
        enableTotalRecordCount: false,
        maxOfficialRating: parentId ? '' : 'PG-13'
    }).then(function ({ data: result }) {
        const images = result.Items.map(function (i) {
            return {
                Id: i.Id,
                tag: i.BackdropImageTags[0],
                ServerId: i.ServerId
            };
        });
        cache[key] = JSON.stringify(images);
        return images;
    });
}

function showBackdrop(type, parentId) {
    const api = ServerConnections.getApi();

    if (api) {
        getBackdropItemIds(api, ServerConnections.getCurrentUserId(), type, parentId).then(function (images) {
            if (images.length) {
                setBackdrops(images.map(function (i) {
                    i.BackdropImageTags = [i.tag];
                    return i;
                }));
            } else {
                clearBackdrop();
            }
        });
    }
}

async function showSplashScreen() {
    const api = ServerConnections.getApi();
    const brandingOptions = await queryClient.fetchQuery(getBrandingOptionsQuery(api));
    if (brandingOptions.SplashscreenEnabled) {
        setBackdropImages([
            api.getUri(SPLASHSCREEN_URL, { t: Date.now() })
        ]);
    } else {
        clearBackdrop();
    }
}

pageClassOn('pageshow', 'page', function () {
    const page = this;

    if (!page.classList.contains('selfBackdropPage')) {
        if (page.classList.contains('backdropPage')) {
            const type = page.getAttribute('data-backdroptype');
            if (type === 'splashscreen') {
                showSplashScreen();
            } else if (enabled()) {
                const parentId = page.classList.contains('globalBackdropPage') ? '' : libraryMenu.getTopParentId();
                showBackdrop(type, parentId);
            } else {
                page.classList.remove('backdropPage');
                clearBackdrop();
            }
        } else {
            clearBackdrop();
        }
    }
});
