import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import dom from '../../utils/dom';
import { appRouter } from './router/appRouter';
import Dashboard from '../../utils/dashboard';

function onGroupedCardClick(e, card) {
    const itemId = card.getAttribute('data-id');
    const serverId = card.getAttribute('data-serverid');
    const api = ServerConnections.getApi(serverId);
    const playedIndicator = card.querySelector('.playedIndicator');
    const playedIndicatorHtml = playedIndicator ? playedIndicator.innerHTML : null;
    const actionableParent = dom.parentWithTag(e.target, ['A', 'BUTTON', 'INPUT']);

    if (!actionableParent || actionableParent.classList.contains('cardContent')) {
        getLibraryApi(api).getLatestMedia({
            userId: ServerConnections.getCurrentUserId(serverId),
            limit: parseInt(playedIndicatorHtml || '10', 10),
            fields: [ItemFields.PrimaryImageAspectRatio, ItemFields.DateCreated],
            parentId: itemId,
            groupItems: false
        }).then(function ({ data: items }) {
            if (items.length === 1) {
                appRouter.showItem(items[0]);
                return;
            }

            const url = 'details?id=' + itemId + '&serverId=' + serverId;
            Dashboard.navigate(url);
        });
        e.stopPropagation();
        e.preventDefault();
        return false;
    }
}

export default function onItemsContainerClick(e) {
    const groupedCard = dom.parentWithClass(e.target, 'groupedCard');

    if (groupedCard) {
        onGroupedCardClick(e, groupedCard);
    }
}
