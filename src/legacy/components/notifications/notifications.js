import { playbackManager } from '../playback/playbackmanager';
import Events from 'utils/events.ts';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getItems } from 'utils/sdk/getItems.ts';
import { getScaledImageUrl } from 'utils/sdk/imageUrls.ts';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';

import NotificationIcon from './notificationicon.png';

function onOneDocumentClick() {
    document.removeEventListener('click', onOneDocumentClick);
    document.removeEventListener('keydown', onOneDocumentClick);

    // don't request notification permissions if they're already granted or denied
    if (window.Notification && window.Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function registerOneDocumentClickHandler() {
    Events.off(ServerConnections, 'localusersignedin', registerOneDocumentClickHandler);

    document.addEventListener('click', onOneDocumentClick);
    document.addEventListener('keydown', onOneDocumentClick);
}

function initPermissionRequest() {
    const api = ServerConnections.getApi();
    if (api) {
        getUserApi(api).getCurrentUser()
            .then(() => registerOneDocumentClickHandler())
            .catch(() => {
                Events.on(ServerConnections, 'localusersignedin', registerOneDocumentClickHandler);
            });
    } else {
        registerOneDocumentClickHandler();
    }
}

initPermissionRequest();

let serviceWorkerRegistration;

function closeAfter(notification, timeoutMs) {
    setTimeout(function () {
        if (notification.close) {
            notification.close();
        } else if (notification.cancel) {
            notification.cancel();
        }
    }, timeoutMs);
}

function resetRegistration() {
    /* eslint-disable-next-line compat/compat */
    const serviceWorker = navigator.serviceWorker;
    if (serviceWorker) {
        serviceWorker.ready.then(function (registration) {
            serviceWorkerRegistration = registration;
        });
    }
}

resetRegistration();

function showPersistentNotification(title, options) {
    serviceWorkerRegistration.showNotification(title, options);
}

function showNonPersistentNotification(title, options, timeoutMs) {
    try {
        const notif = new Notification(title, options); /* eslint-disable-line compat/compat */

        if (notif.show) {
            notif.show();
        }

        if (timeoutMs) {
            closeAfter(notif, timeoutMs);
        }
    } catch (err) {
        if (options.actions) {
            options.actions = [];
            showNonPersistentNotification(title, options, timeoutMs);
        } else {
            throw err;
        }
    }
}

function showNotification(options, timeoutMs, serverId) {
    const title = options.title;

    options.data = options.data || {};
    options.data.serverId = serverId;
    options.icon = options.icon || NotificationIcon;
    options.badge = options.badge || NotificationIcon;

    resetRegistration();

    if (serviceWorkerRegistration) {
        showPersistentNotification(title, options);
        return;
    }

    showNonPersistentNotification(title, options, timeoutMs);
}

function showNewItemNotification(item, api) {
    if (playbackManager.isPlayingLocally(['Video'])) {
        return;
    }

    let body = item.Name;

    if (item.SeriesName) {
        body = item.SeriesName + ' - ' + body;
    }

    const notification = {
        title: 'New ' + item.Type,
        body: body,
        vibrate: true,
        tag: 'newItem' + item.Id,
        data: {}
    };

    const imageTags = item.ImageTags || {};

    if (imageTags.Primary) {
        notification.icon = getScaledImageUrl(api, item.Id, ImageType.Primary, {
            width: 80,
            tag: imageTags.Primary
        });
    }

    showNotification(notification, 15000, item.ServerId);
}

function onLibraryChanged(data, api, serverId) {
    const newItems = data.ItemsAdded;

    if (!newItems.length) {
        return;
    }

    // Don't put a massive number of Id's onto the query string
    if (newItems.length > 12) {
        newItems.length = 12;
    }

    getItems(api, {
        userId: ServerConnections.getCurrentUserId(serverId),
        recursive: true,
        limit: 3,
        filters: [ItemFilter.IsNotFolder],
        sortBy: [ItemSortBy.DateCreated],
        sortOrder: [SortOrder.Descending],
        ids: newItems,
        mediaTypes: [MediaType.Audio, MediaType.Video],
        enableTotalRecordCount: false
    }).then(function (result) {
        const items = result.Items;

        for (const item of items) {
            showNewItemNotification(item, api);
        }
    });
}

function showPackageInstallNotification(api, serverId, installation, status) {
    getUserApi(api).getCurrentUser().then(function ({ data: user }) {
        if (!user.Policy.IsAdministrator) {
            return;
        }

        const notification = {
            tag: 'install' + installation.Id,
            data: {}
        };

        if (status === 'completed') {
            notification.title = globalize.translate('PackageInstallCompleted', installation.Name, installation.Version);
            notification.vibrate = true;
        } else if (status === 'cancelled') {
            notification.title = globalize.translate('PackageInstallCancelled', installation.Name, installation.Version);
        } else if (status === 'failed') {
            notification.title = globalize.translate('PackageInstallFailed', installation.Name, installation.Version);
            notification.vibrate = true;
        } else if (status === 'progress') {
            notification.title = globalize.translate('InstallingPackage', installation.Name, installation.Version);

            notification.actions =
                [
                    {
                        action: 'cancel-install',
                        title: globalize.translate('ButtonCancel'),
                        icon: NotificationIcon
                    }
                ];

            notification.data.id = installation.id;
        }

        if (status === 'progress') {
            const percentComplete = Math.round(installation.PercentComplete || 0);

            notification.body = percentComplete + '% complete.';
        }

        const timeout = status === 'cancelled' ? 5000 : 0;

        showNotification(notification, timeout, serverId);
    });
}

const subscriptions = [];

function subscribeToServer(serverId) {
    const api = ServerConnections.getApi(serverId);
    const serverName = ServerConnections.getServerInfo(serverId)?.Name;
    const clientSubscriptions = [
        api?.subscribe?.([OutboundWebSocketMessageType.LibraryChanged], ({ Data }) => {
            onLibraryChanged(Data, api, serverId);
        }),
        api?.subscribe?.([OutboundWebSocketMessageType.PackageInstallationCompleted], ({ Data }) => {
            showPackageInstallNotification(api, serverId, Data, 'completed');
        }),
        api?.subscribe?.([OutboundWebSocketMessageType.PackageInstallationFailed], ({ Data }) => {
            showPackageInstallNotification(api, serverId, Data, 'failed');
        }),
        api?.subscribe?.([OutboundWebSocketMessageType.PackageInstallationCancelled], ({ Data }) => {
            showPackageInstallNotification(api, serverId, Data, 'cancelled');
        }),
        api?.subscribe?.([OutboundWebSocketMessageType.PackageInstalling], ({ Data }) => {
            showPackageInstallNotification(api, serverId, Data, 'progress');
        }),

        api?.subscribe?.([OutboundWebSocketMessageType.ServerShuttingDown], () => {
            const notification = {
                tag: 'restart' + serverId,
                title: globalize.translate('ServerNameIsShuttingDown', serverName)
            };
            showNotification(notification, 0, serverId);
        }),

        api?.subscribe?.([OutboundWebSocketMessageType.ServerRestarting], () => {
            const notification = {
                tag: 'restart' + serverId,
                title: globalize.translate('ServerNameIsRestarting', serverName)
            };
            showNotification(notification, 0, serverId);
        }),

        api?.subscribe?.([OutboundWebSocketMessageType.RestartRequired], () => {
            const notification = {
                tag: 'restart' + serverId,
                title: globalize.translate('PleaseRestartServerName', serverName)
            };

            notification.actions =
                [
                    {
                        action: 'restart',
                        title: globalize.translate('Restart'),
                        icon: NotificationIcon
                    }
                ];

            showNotification(notification, 0, serverId);
        })
    ].filter(Boolean);

    return () => clientSubscriptions.forEach((unsub) => {
        unsub();
    });
}

/**
 * Add subscriptions when a connection to a server is created
 */
Events.on(ServerConnections, 'apiclientcreated', (e, newApiClient) => {
    subscriptions.push(subscribeToServer(newApiClient.serverId()));
});

/**
 * Remove subscriptions when the user logs out
 */
Events.on(ServerConnections, 'localusersignedout', () => {
    subscriptions.forEach((unsub) => {
        unsub();
    });
});

/**
 * Remove subscriptions when the page unloads
 */
window.addEventListener('beforeunload', () => {
    subscriptions.forEach(unsub => {
        unsub();
    });
});
