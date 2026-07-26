import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import itemHelper from 'components/itemHelper';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';
import { getScaledImageUrl } from 'utils/sdk/imageUrls';

type NowPlayingInfo = {
    topText?: string;
    bottomText: string;
    image?: string;
};

const getNowPlayingName = (session: SessionInfoDto): NowPlayingInfo => {
    let imgUrl = '';
    const nowPlayingItem = session.NowPlayingItem;
    // FIXME: It seems that, sometimes, server sends date in the future, so date-fns displays messages like 'in less than a minute'. We should fix
    // how dates are returned by the server when the session is active and show something like 'Active now', instead of past/future sentences
    if (!nowPlayingItem) {
        return {
            bottomText: globalize.translate('LastSeen', formatDistanceToNow(Date.parse(session.LastActivityDate!), getLocaleWithSuffix()))
        };
    }

    let topText = itemHelper.getDisplayName(nowPlayingItem);
    let bottomText = '';

    if (nowPlayingItem.Artists?.length) {
        bottomText = topText;
        topText = nowPlayingItem.Artists[0];
    } else if (nowPlayingItem.SeriesName || nowPlayingItem.Album) {
        bottomText = topText;
        topText = nowPlayingItem.SeriesName || nowPlayingItem.Album;
    } else if (nowPlayingItem.ProductionYear) {
        bottomText = nowPlayingItem.ProductionYear.toString();
    }

    const api = ServerConnections.getApi(session.ServerId ?? undefined);
    if (api) {
        if (nowPlayingItem.ImageTags?.Logo) {
            imgUrl = getScaledImageUrl(api, nowPlayingItem.Id!, ImageType.Logo, {
                tag: nowPlayingItem.ImageTags.Logo,
                maxHeight: 24,
                maxWidth: 130
            });
        } else if (nowPlayingItem.ParentLogoImageTag) {
            imgUrl = getScaledImageUrl(api, nowPlayingItem.ParentLogoItemId!, ImageType.Logo, {
                tag: nowPlayingItem.ParentLogoImageTag ?? undefined,
                maxHeight: 24,
                maxWidth: 130
            });
        }
    }

    return {
        topText,
        bottomText,
        image: imgUrl
    };
};

export default getNowPlayingName;
