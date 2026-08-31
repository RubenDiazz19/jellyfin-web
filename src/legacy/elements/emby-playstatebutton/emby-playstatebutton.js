import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import EmbyButtonPrototype from 'elements/emby-button/emby-button';

function onClick() {
    const button = this;
    const itemId = button.getAttribute('data-id');
    const serverId = button.getAttribute('data-serverid');
    const userDataApi = getUserDataApi(ServerConnections.getApi(serverId));
    const userId = ServerConnections.getCurrentUserId(serverId);

    if (!button.classList.contains('playstatebutton-played')) {
        void userDataApi.markPlayedItem({ itemId, userId, datePlayed: new Date().toISOString() });
        setState(button, true);
    } else {
        void userDataApi.markUnplayedItem({ itemId, userId });
        setState(button, false);
    }
}

function onUserDataChanged({ Data }, button) {
    const itemId = button.dataset.id;
    const userData = (Data?.UserDataList ?? []).find(u => u.ItemId === itemId);
    if (userData) {
        setState(button, userData.Played);
    }
}

function setState(button, played, updateAttribute) {
    let icon = button.iconElement;
    if (!icon) {
        button.iconElement = button.querySelector('.material-icons');
        icon = button.iconElement;
    }

    if (played) {
        button.classList.add('playstatebutton-played');
        if (icon) {
            icon.classList.add('playstatebutton-icon-played');
            icon.classList.remove('playstatebutton-icon-unplayed');
        }
    } else {
        button.classList.remove('playstatebutton-played');
        if (icon) {
            icon.classList.remove('playstatebutton-icon-played');
            icon.classList.add('playstatebutton-icon-unplayed');
        }
    }

    if (updateAttribute !== false) {
        button.setAttribute('data-played', played);
    }

    setTitle(button, button.getAttribute('data-type'), played);
}

function setTitle(button, itemType, played) {
    if (itemType !== 'AudioBook') {
        button.title = played ? globalize.translate('Watched') : globalize.translate('MarkPlayed');
    } else {
        button.title = played ? globalize.translate('Played') : globalize.translate('MarkPlayed');
    }

    const text = button.querySelector('.button-text');
    if (text) {
        text.innerText = button.title;
    }
}

function clearEvents(button) {
    button.removeEventListener('click', onClick);
    button._unsubscribeUserData?.();
    button._unsubscribeUserData = null;
}

function bindEvents(button) {
    clearEvents(button);

    button.addEventListener('click', onClick);
    const serverId = button.dataset.serverid;
    const api = ServerConnections.getApi(serverId);
    button._unsubscribeUserData = api?.subscribe(
        [OutboundWebSocketMessageType.UserDataChanged],
        (msg) => onUserDataChanged(msg, button)
    );
}

const EmbyPlaystateButtonPrototype = Object.create(EmbyButtonPrototype);

EmbyPlaystateButtonPrototype.createdCallback = function () {
    // base method
    if (EmbyButtonPrototype.createdCallback) {
        EmbyButtonPrototype.createdCallback.call(this);
    }
};

EmbyPlaystateButtonPrototype.attachedCallback = function () {
    // base method
    if (EmbyButtonPrototype.attachedCallback) {
        EmbyButtonPrototype.attachedCallback.call(this);
    }

    const itemId = this.getAttribute('data-id');
    const serverId = this.getAttribute('data-serverid');
    if (itemId && serverId) {
        setState(this, this.getAttribute('data-played') === 'true', false);
        bindEvents(this);
    }
};

EmbyPlaystateButtonPrototype.detachedCallback = function () {
    // base method
    if (EmbyButtonPrototype.detachedCallback) {
        EmbyButtonPrototype.detachedCallback.call(this);
    }

    clearEvents(this);
    this.iconElement = null;
};

EmbyPlaystateButtonPrototype.setItem = function (item) {
    if (item) {
        this.setAttribute('data-id', item.Id);
        this.setAttribute('data-serverid', item.ServerId);
        this.setAttribute('data-type', item.Type);

        const played = item.UserData?.Played;
        setState(this, played);
        bindEvents(this);
    } else {
        this.removeAttribute('data-id');
        this.removeAttribute('data-serverid');
        this.removeAttribute('data-type');
        this.removeAttribute('data-played');
        clearEvents(this);
    }
};

document.registerElement?.('emby-playstatebutton', {
    prototype: EmbyPlaystateButtonPrototype,
    extends: 'button'
});

