import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import Screenfull from 'screenfull';

import Events from '../../utils/events.ts';
import datetime from '../../scripts/datetime';
import appSettings from '../../scripts/settings/appSettings';
import itemHelper from '../itemHelper';
import { pluginManager } from '../pluginManager';
import PlayQueueManager from './playqueuemanager';
import { PlaybackProgressTimer } from 'components/playback/utils/PlaybackProgressTimer';
import { PlayerStateManager } from 'components/playback/utils/PlayerStateManager';
import * as userSettings from '../../scripts/settings/userSettings';
import loading from '../loading/loading';
import { appHost } from '../apphost';
import { getItemBackdropImageUrl } from '../../utils/sdk/backdropImage';

import { PlayerEvent } from 'components/playback/constants/playerEvent';
import {
    enableLocalPlaylistManagement,
    getAutomaticPlayers,
    supportsPhysicalVolumeControl
} from 'components/playback/utils/playerCapabilities';
import { setStreamUrls } from 'components/playback/utils/audioStreamUrl';
import {
    enablePlaybackRetryWithTranscoding,
    getDeliveryMethod,
    isAudioStreamSupported
} from 'components/playback/utils/mediaStreams';
import { getMimeType } from 'components/playback/utils/mimeTypes';
import { autoSetNextTracks } from 'components/playback/utils/trackMatching';
import {
    createStreamInfoFromUrlItem,
    normalizePlayOptions,
    truncatePlayOptions
} from 'components/playback/utils/playOptions';
import {
    getIntros,
    getItemsForPlayback,
    isServerItem,
    mergePlaybackQueries,
    UNLIMITED_ITEMS
} from 'components/playback/utils/playbackQueries';
import {
    getLiveStream,
    getOptimalMediaSource,
    getPlaybackInfo,
    showPlaybackInfoErrorMessage,
    supportsDirectPlay,
    validatePlaybackInfoResult
} from 'components/playback/utils/mediaResolution';
import {
    getNowPlayingItemForReporting,
    reportPlayback
} from 'components/playback/utils/playbackReporting';
import { bindToFullscreenChange, triggerPlayerChange } from 'components/playback/utils/playerEvents';
import { bindProgressEvents } from 'components/playback/utils/playerProgressEvents';
import {
    createTarget,
    displayPlayerIndividually,
    getPlayerTargets,
    normalizeName,
    sortPlayerTargets
} from 'components/playback/utils/playerTargets';
import { bindMediaSegmentManager } from 'components/playback/utils/mediaSegmentManager';
import { bindMediaSessionSubscriber } from 'components/playback/utils/mediaSessionSubscriber';
import { AppFeature } from 'constants/appFeature';
import { PluginType } from 'constants/pluginType';
import { TICKS_PER_SECOND } from 'constants/time';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import { MediaError } from 'types/mediaError';
import { getMediaError } from 'utils/mediaError';
import * as bitrateTest from 'utils/bitrateTest';
import { getUrlParameter } from 'utils/url';

/**
 * Servidor y usuario contra los que se resuelven los medios de un item.
 * @param {string} serverId El id del servidor.
 * @returns {{api: import('@jellyfin/sdk').Api, userId: string}} El contexto.
 */
function getMediaContext(serverId) {
    return {
        api: ServerConnections.getApi(serverId),
        userId: ServerConnections.getCurrentUserId(serverId)
    };
}

export class PlaybackManager {
    constructor() {
        this._playNextAfterEnded = true;

        // Estado propio de la instancia. Vivía como variables locales del
        // constructor, lo que obligaba a que todo lo que las tocara fuese una
        // closure de aquí dentro. Como propiedades, esas closures pueden
        // convertirse en métodos (D1.12).

        /** Players registrados, ordenados por prioridad. @type {object[]} */
        this._players = [];
        /** Destino activo (dispositivo donde se reproduce). */
        this._currentTargetInfo = undefined;
        /** Emparejamiento en curso, para no lanzar dos a la vez. */
        this._currentPairingId = null;
        /** Handler de 'stopped' de cada player, para poder desengancharlo. */
        this._stoppedHandlers = new Map();

        this._playQueueManager = new PlayQueueManager();
        this._playerStateManager = new PlayerStateManager();
        this._progressTimer = new PlaybackProgressTimer();

        // Los players son plugins: los que ya estén registrados se toman
        // ahora, y los que lleguen después, al registrarse.
        Events.on(pluginManager, 'registered', (e, plugin) => {
            if (plugin.type === PluginType.MediaPlayer) {
                this._initMediaPlayer(plugin);
            }
        });
        pluginManager.ofType(PluginType.MediaPlayer)
            .forEach((plugin) => {
                this._initMediaPlayer(plugin);
            });

        if (appHost.supports(AppFeature.RemoteControl)) {
            // Defer setup past module evaluation to avoid the circular dependency:
            // playbackmanager → lib/jellyfin-apiclient → ServerConnections → utils/dashboard → backdrop → playbackmanager
            queueMicrotask(() => {
                let _unsubscribeRemoteControl;
                Events.on(ServerConnections, 'localusersignedin', () => {
                    _unsubscribeRemoteControl?.();
                    const api = ServerConnections.getApi();
                    _unsubscribeRemoteControl = api?.subscribe(
                        [OutboundWebSocketMessageType.ServerShuttingDown, OutboundWebSocketMessageType.ServerRestarting],
                        () => this.setDefaultPlayerActive()
                    );
                });
                Events.on(ServerConnections, 'localusersignedout', () => {
                    _unsubscribeRemoteControl?.();
                });
            });
        }

        bindMediaSegmentManager(this);
    }

    getPlaybackMediaSources(item, options) {
        options = options || {};
        const startPosition = options.startPositionTicks || 0;
        const mediaType = options.mediaType || item.MediaType;
        // `forceLocalPlayer` a true a propósito: esto solo consulta las
        // fuentes disponibles, no reproduce. El perfil que hay que
        // preguntar es el de este dispositivo aunque haya una sesión
        // remota activa, porque la respuesta se usa para pintar el
        // selector de versiones aquí.
        const player = this._getPlayer(item, options, true);
        const apiClient = ServerConnections.getApiClient(item.ServerId);

        // Call this just to ensure the value is recorded, it is needed with getSavedMaxStreamingBitrate
        return apiClient.getEndpointInfo().then(() => {
            const maxBitrate = this._getSavedMaxStreamingBitrate(ServerConnections.getApiClient(item.ServerId), mediaType);

            return player.getDeviceProfile(item).then((deviceProfile) => {
                const mediaOptions = {
                    maxBitrate,
                    startPosition,
                    isPlayback: true,
                    audioStreamIndex: null,
                    subtitleStreamIndex: null,
                    enableDirectPlay: null,
                    enableDirectStream: null,
                    allowVideoStreamCopy: null,
                    allowAudioStreamCopy: null
                };

                return getPlaybackInfo(player, getMediaContext(item.ServerId), item, deviceProfile, null, null, mediaOptions).then((playbackInfoResult) => {
                    return playbackInfoResult.MediaSources;
                });
            });
        });
    }

    setActivePlayer(player, targetInfo) {
        if (player === 'localplayer' || player.name === 'localplayer') {
            if (this._currentPlayer?.isLocalPlayer) {
                return;
            }
            this._setCurrentPlayerInternal(null, null);
            return;
        }

        if (typeof (player) === 'string') {
            player = this._players.filter((p) => {
                return p.name === player;
            })[0];
        }

        if (!player) {
            throw new Error('null player');
        }

        this._setCurrentPlayerInternal(player, targetInfo);
    }

    trySetActivePlayer(player, targetInfo) {
        if (player === 'localplayer' || player.name === 'localplayer') {
            if (this._currentPlayer?.isLocalPlayer) {
                return;
            }
            return;
        }

        if (typeof (player) === 'string') {
            player = this._players.filter((p) => {
                return p.name === player;
            })[0];
        }

        if (!player) {
            throw new Error('null player');
        }

        if (this._currentPairingId === targetInfo.id) {
            return;
        }

        this._currentPairingId = targetInfo.id;

        const promise = player.tryPair ?
            player.tryPair(targetInfo) :
            Promise.resolve();

        Events.trigger(this, 'pairing');

        promise.then(() => {
            Events.trigger(this, 'paired');
            this._setCurrentPlayerInternal(player, targetInfo);
        }, () => {
            Events.trigger(this, 'pairerror');
            if (this._currentPairingId === targetInfo.id) {
                this._currentPairingId = null;
            }
        });
    }

    setAudioStreamIndex(index, player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.setAudioStreamIndex(index);
        }

        if (this.playMethod(player) === 'Transcode' || !player.canSetAudioStreamIndex()) {
            this._changeStream(player, this._getCurrentTicks(player), { AudioStreamIndex: index });
            this._playerData(player).audioStreamIndex = index;
        } else {
            // See if the player supports the track without transcoding
            player.getDeviceProfile(this.currentItem(player)).then((profile) => {
                if (isAudioStreamSupported(this.currentMediaSource(player), index, profile)) {
                    player.setAudioStreamIndex(index);
                    this._playerData(player).audioStreamIndex = index;
                } else {
                    this._changeStream(player, this._getCurrentTicks(player), { AudioStreamIndex: index });
                    this._playerData(player).audioStreamIndex = index;
                }
            });
        }
    }

    setMaxStreamingBitrate(options, player) {
        player = player || this._currentPlayer;
        if (player?.setMaxStreamingBitrate) {
            return player.setMaxStreamingBitrate(options);
        }

        const api = ServerConnections.getApi(this.currentItem(player).ServerId);
        const apiClient = ServerConnections.getApiClient(this.currentItem(player).ServerId);

        apiClient.getEndpointInfo().then((endpointInfo) => {
            const playerData = this._playerData(player);
            const mediaType = playerData.streamInfo ? playerData.streamInfo.mediaType : null;

            let promise;
            if (options.enableAutomaticBitrateDetection) {
                appSettings.enableAutomaticBitrateDetection(endpointInfo.IsInNetwork, mediaType, true);
                promise = bitrateTest.detectBitrate(api, true);
            } else {
                appSettings.enableAutomaticBitrateDetection(endpointInfo.IsInNetwork, mediaType, false);
                promise = Promise.resolve(options.maxBitrate);
            }

            promise.then((bitrate) => {
                appSettings.maxStreamingBitrate(endpointInfo.IsInNetwork, mediaType, bitrate);

                this._changeStream(player, this._getCurrentTicks(player), {
                    MaxStreamingBitrate: bitrate
                });
            });
        });
    }

    getPlaybackInfo(item, options) {
        options = options || {};
        const startPosition = options.startPositionTicks || 0;
        const mediaType = options.mediaType || item.MediaType;
        const player = this._getPlayer(item, options);
        const apiClient = ServerConnections.getApiClient(item.ServerId);

        // Call this just to ensure the value is recorded, it is needed with getSavedMaxStreamingBitrate
        return apiClient.getEndpointInfo().then(() => {
            const maxBitrate = this._getSavedMaxStreamingBitrate(ServerConnections.getApiClient(item.ServerId), mediaType);

            return player.getDeviceProfile(item).then((deviceProfile) => {
                const mediaOptions = {
                    maxBitrate,
                    startPosition,
                    isPlayback: null,
                    audioStreamIndex: options.audioStreamIndex,
                    subtitleStreamIndex: options.subtitleStreamIndex,
                    startIndex: null,
                    enableDirectPlay: null,
                    enableDirectStream: null,
                    allowVideoStreamCopy: null,
                    allowAudioStreamCopy: null
                };

                return this._getPlaybackMediaSource(player, getMediaContext(item.ServerId), deviceProfile, item, options.mediaSourceId, mediaOptions).then((mediaSource) => {
                    return this._createStreamInfo(apiClient, item.MediaType, item, mediaSource, startPosition, player);
                });
            });
        });
    }

    setCurrentPlaylistItem(playlistItemId, player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.setCurrentPlaylistItem(playlistItemId);
        }

        const newItem = this.getItemFromPlaylistItemId(playlistItemId);

        if (newItem.Item) {
            const newItemPlayOptions = newItem.Item.playOptions || this._getDefaultPlayOptions();

            this._playInternal(newItem.Item, newItemPlayOptions, () => {
                this._setPlaylistState(newItem.Item.PlaylistItemId, newItem.Index);
            });
        }
    }

    nextTrack(player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.nextTrack();
        }

        const newItemInfo = this._playQueueManager.getNextItemInfo();

        if (newItemInfo) {
            console.debug('playing next track');

            const newItemPlayOptions = newItemInfo.item.playOptions || this._getDefaultPlayOptions();

            this._playInternal(newItemInfo.item, newItemPlayOptions, () => {
                this._setPlaylistState(newItemInfo.item.PlaylistItemId, newItemInfo.index);
            }, this._getPreviousSource(player));
        }
    }

    previousTrack(player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.previousTrack();
        }

        const newIndex = this.getCurrentPlaylistIndex(player) - 1;
        if (newIndex >= 0) {
            const playlist = this._playQueueManager.getPlaylist();
            const newItem = playlist[newIndex];

            if (newItem) {
                const newItemPlayOptions = newItem.playOptions || this._getDefaultPlayOptions();
                newItemPlayOptions.startPositionTicks = 0;

                this._playInternal(newItem, newItemPlayOptions, () => {
                    this._setPlaylistState(newItem.PlaylistItemId, newIndex);
                }, this._getPreviousSource(player));
            }
        }
    }

    onAppClose() {
        const player = this._currentPlayer;

        // Try to report playback stopped before the app closes
        if (player && this.isPlaying(player)) {
            this._playNextAfterEnded = false;
            this._onPlaybackStopped(player);
            // Kill the underlying media element too — without this the
            // <video> keeps playing (and streaming) if the browser
            // discards the unload but keeps the page alive (bfcache,
            // aggressive tab close on Chromium desktop).
            try {
                player.stop(true, true);
            } catch { /* swallow */ }
        }
    }

    /**
     * Handler de `onPlaybackStartedFromSelfManagingPlayer`. El player llega por parámetro: antes venía
     * como `this`, porque Events invoca al handler con el objeto que emite.
     */
    _onPlaybackStartedFromSelfManagingPlayer(player, e, item, mediaSource) {
        this._setCurrentPlayerInternal(player);

        const playOptions = item.playOptions || this._getDefaultPlayOptions();
        const isFirstItem = playOptions.isFirstItem;
        const fullscreen = playOptions.fullscreen;

        playOptions.isFirstItem = false;

        const playerData = this._playerData(player);
        playerData.streamInfo = {};

        const streamInfo = playerData.streamInfo;
        streamInfo.playbackStartTimeTicks = new Date().getTime() * 10000;

        const state = this.getPlayerState(player, item, mediaSource);

        reportPlayback(this, state, player, true, state.NowPlayingItem.ServerId, 'reportPlaybackStart');

        state.IsFirstItem = isFirstItem;
        state.IsFullscreen = fullscreen;
        Events.trigger(player, 'playbackstart', [state]);
        Events.trigger(this, 'playbackstart', [player, state]);

        // only used internally as a safeguard to avoid reporting other events to the server before playback start
        streamInfo.started = true;

        this._startPlaybackProgressTimer(player);
    }

    /**
     * Handler de `onPlaybackStoppedFromSelfManagingPlayer`. El player llega por parámetro: antes venía
     * como `this`, porque Events invoca al handler con el objeto que emite.
     */
    _onPlaybackStoppedFromSelfManagingPlayer(player, e, playerStopInfo) {
        this._stopPlaybackProgressTimer(player);
        const state = this.getPlayerState(player, playerStopInfo.item, playerStopInfo.mediaSource);

        const nextItem = playerStopInfo.nextItem;
        const nextMediaType = playerStopInfo.nextMediaType;

        const playbackStopInfo = {
            player: player,
            state: state,
            nextItem: (nextItem ? nextItem.item : null),
            nextMediaType: nextMediaType
        };

        state.NextMediaType = nextMediaType;

        const streamInfo = this._playerData(player).streamInfo;

        // only used internally as a safeguard to avoid reporting other events to the server after playback stopped
        streamInfo.ended = true;

        if (isServerItem(playerStopInfo.item)) {
            state.PlayState.PositionTicks = (playerStopInfo.positionMs || 0) * 10000;

            reportPlayback(this, state, player, true, playerStopInfo.item.ServerId, 'reportPlaybackStopped');
        }

        state.NextItem = playbackStopInfo.nextItem;

        Events.trigger(player, 'playbackstop', [state]);
        Events.trigger(this, 'playbackstop', [playbackStopInfo]);

        const nextItemPlayOptions = nextItem ? (nextItem.item.playOptions || this._getDefaultPlayOptions()) : this._getDefaultPlayOptions();
        const newPlayer = nextItem ? this._getPlayer(nextItem.item, nextItemPlayOptions) : null;

        if (newPlayer !== player) {
            this._destroyPlayer(player);
            this._removeCurrentPlayer(player);
        }
    }

    /**
     * Handler de `onPlaybackError`. El player llega por parámetro: antes venía
     * como `this`, porque Events invoca al handler con el objeto que emite.
     */
    _onPlaybackError(player, e, error) {
        error = error || {};

        const errorType = error.type;

        console.warn('[playbackmanager] onPlaybackError:', e, error);

        const streamInfo = error.streamInfo || this._playerData(player).streamInfo;

        if (streamInfo?.url) {
            const isAlreadyFallbacking = streamInfo.url.toLowerCase().includes('transcodereasons');
            const currentlyPreventsVideoStreamCopy = streamInfo.url.toLowerCase().indexOf('allowvideostreamcopy=false') !== -1;
            const currentlyPreventsAudioStreamCopy = streamInfo.url.toLowerCase().indexOf('allowaudiostreamcopy=false') !== -1;

            // Auto switch to transcoding
            if (enablePlaybackRetryWithTranscoding(
                streamInfo.mediaSource,
                currentlyPreventsVideoStreamCopy,
                currentlyPreventsAudioStreamCopy
            )) {
                const startTime = this._getCurrentTicks(player) || streamInfo.playerStartPositionTicks;
                const isRemoteSource = streamInfo.item.LocationType === 'Remote';
                // force transcoding and only allow remuxing for remote source like liveTV, but only for initial trial
                const tryVideoStreamCopy = isRemoteSource && !isAlreadyFallbacking;

                this._changeStream(player, startTime, {
                    EnableDirectPlay: false,
                    EnableDirectStream: tryVideoStreamCopy,
                    AllowVideoStreamCopy: tryVideoStreamCopy,
                    AllowAudioStreamCopy: currentlyPreventsAudioStreamCopy || currentlyPreventsVideoStreamCopy ? false : null
                });

                return;
            }
        }

        Events.trigger(this, 'playbackerror', [errorType]);

        this._onPlaybackStopped(player, e, `.${errorType}`);
    }

    /**
     * Handler de `onPlaybackStopped`. El player llega por parámetro: antes venía
     * como `this`, porque Events invoca al handler con el objeto que emite.
     */
    _onPlaybackStopped(player, e, displayErrorCode) {
        if (this._playerData(player).isChangingStream) {
            return;
        }

        this._stopPlaybackProgressTimer(player);

        // User clicked stop or content ended
        const state = this.getPlayerState(player);
        const data = this._playerData(player);
        const streamInfo = data.streamInfo;

        const errorOccurred = displayErrorCode && typeof (displayErrorCode) === 'string';

        const nextItem = this._playNextAfterEnded && !errorOccurred ? this._playQueueManager.getNextItemInfo() : null;

        const nextMediaType = (nextItem ? nextItem.item.MediaType : null);

        const playbackStopInfo = {
            player: player,
            state: state,
            nextItem: (nextItem ? nextItem.item : null),
            nextMediaType: nextMediaType
        };

        state.NextMediaType = nextMediaType;

        if (streamInfo && isServerItem(streamInfo.item)) {
            if (player.supportsProgress === false && state.PlayState && !state.PlayState.PositionTicks) {
                state.PlayState.PositionTicks = streamInfo.item.RunTimeTicks;
            }

            // only used internally as a safeguard to avoid reporting other events to the server after playback stopped
            streamInfo.ended = true;

            reportPlayback(this, state, player, true, streamInfo.item.ServerId, 'reportPlaybackStopped');
        }

        state.NextItem = playbackStopInfo.nextItem;

        if (!nextItem) {
            this._playQueueManager.reset();
        }

        Events.trigger(player, 'playbackstop', [state]);
        Events.trigger(this, 'playbackstop', [playbackStopInfo]);

        const nextItemPlayOptions = nextItem ? (nextItem.item.playOptions || this._getDefaultPlayOptions()) : this._getDefaultPlayOptions();
        const newPlayer = nextItem ? this._getPlayer(nextItem.item, nextItemPlayOptions) : null;

        if (!newPlayer) {
            data.streamInfo = null;
            this._destroyPlayer(player);
            this._removeCurrentPlayer(player);
        }

        if (errorOccurred) {
            showPlaybackInfoErrorMessage('PlaybackError' + displayErrorCode);
        } else if (newPlayer) {
            const apiClient = ServerConnections.getApiClient(nextItem.item.ServerId);

            apiClient.getCurrentUser().then((user) => {
                if (user.Configuration.EnableNextEpisodeAutoPlay || nextMediaType !== MediaType.Video) {
                    this.nextTrack();

                    if (newPlayer !== player) {
                        Events.trigger(this, 'playbackstop', [{
                            player,
                            state,
                            nextItem,
                            nextMediaType
                        }]);
                    }
                }
            });
        }
    }

    /** Resuelve la lista real de items a reproducir. Parte de la API pública. */
    translateItemsForPlayback(items, options) {
        return this._translateItemsForPlayback(items, options);
    }

    /** Consulta items del servidor para reproducirlos. Parte de la API pública. */
    getItemsForPlayback(serverId, query) {
        return getItemsForPlayback(serverId, query);
    }

    /** Posición actual en ticks. Se expone porque la usan el OSD y el dashboard. */
    getCurrentTicks(player) {
        return this._getCurrentTicks(player);
    }

    canPlay(item) {
        const itemType = item.Type;

        if (itemType === 'Book' || itemType === 'PhotoAlbum' || itemType === 'MusicGenre' || itemType === 'Season' || itemType === 'Series' || itemType === 'BoxSet' || itemType === 'MusicAlbum' || itemType === 'MusicArtist' || itemType === 'Playlist') {
            return true;
        }

        if (item.LocationType === 'Virtual' && itemType !== 'Program') {
            return false;
        }

        if (itemType === 'Program') {
            if (!item.EndDate || !item.StartDate) {
                return false;
            }

            if (new Date().getTime() > datetime.parseISO8601Date(item.EndDate).getTime() || new Date().getTime() < datetime.parseISO8601Date(item.StartDate).getTime()) {
                return false;
            }
        }

        return this._getPlayer(item, this._getDefaultPlayOptions()) != null;
    }

    getMaxStreamingBitrate(player) {
        player = player || this._currentPlayer;
        if (player?.getMaxStreamingBitrate) {
            return player.getMaxStreamingBitrate();
        }

        const playerData = this._playerData(player);

        if (playerData.maxStreamingBitrate) {
            return playerData.maxStreamingBitrate;
        }

        const mediaType = playerData.streamInfo ? playerData.streamInfo.mediaType : null;
        const currentItem = this.currentItem(player);

        const apiClient = currentItem ? ServerConnections.getApiClient(currentItem.ServerId) : ServerConnections.currentApiClient();
        return this._getSavedMaxStreamingBitrate(apiClient, mediaType);
    }

    setSubtitleStreamIndex(index, player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.setSubtitleStreamIndex(index);
        }

        const currentStream = this._getCurrentSubtitleStream(player);

        const newStream = this.getSubtitleStream(player, index);

        if (!currentStream && !newStream) {
            return;
        }

        let selectedTrackElementIndex = -1;

        const currentPlayMethod = this.playMethod(player);

        if (currentStream && !newStream) {
            if (getDeliveryMethod(currentStream) === 'Encode' || (getDeliveryMethod(currentStream) === 'Embed' && currentPlayMethod === 'Transcode')) {
                // Need to change the transcoded stream to remove subs
                this._changeStream(player, this._getCurrentTicks(player), { SubtitleStreamIndex: -1 });
            }
        } else if (!currentStream && newStream) {
            if (getDeliveryMethod(newStream) === 'External') {
                selectedTrackElementIndex = index;
            } else if (getDeliveryMethod(newStream) === 'Embed' && currentPlayMethod !== 'Transcode') {
                selectedTrackElementIndex = index;
            } else {
                // Need to change the transcoded stream to add subs
                this._changeStream(player, this._getCurrentTicks(player), { SubtitleStreamIndex: index });
            }
        } else if (currentStream && newStream) {
            // Switching tracks
            // We can handle this clientside if the new track is external or the new track is embedded and we're not transcoding
            if (getDeliveryMethod(newStream) === 'External' || (getDeliveryMethod(newStream) === 'Embed' && currentPlayMethod !== 'Transcode')) {
                selectedTrackElementIndex = index;

                // But in order to handle this client side, if the previous track is being added via transcoding, we'll have to remove it
                if (getDeliveryMethod(currentStream) !== 'External' && getDeliveryMethod(currentStream) !== 'Embed') {
                    this._changeStream(player, this._getCurrentTicks(player), { SubtitleStreamIndex: -1 });
                }
            } else {
                // Need to change the transcoded stream to add subs
                this._changeStream(player, this._getCurrentTicks(player), { SubtitleStreamIndex: index });
            }
        }

        player.setSubtitleStreamIndex(selectedTrackElementIndex);

        // Also disable secondary subtitles when disabling the primary
        // subtitles, or if it doesn't support a secondary pair
        if (selectedTrackElementIndex === -1 || !this.trackHasSecondarySubtitleSupport(newStream)) {
            this.setSecondarySubtitleStreamIndex(-1);
        }

        this._playerData(player).subtitleStreamIndex = index;
    }

    setSecondarySubtitleStreamIndex(index, player) {
        player = player || this._currentPlayer;
        if (!this.playerHasSecondarySubtitleSupport(player)) return;
        if (player && !enableLocalPlaylistManagement(player)) {
            try {
                return player.setSecondarySubtitleStreamIndex(index);
            } catch (e) {
                console.error('[playbackmanager] AutoSet - Failed to set secondary track:', e);
            }
        }

        const currentStream = this._getCurrentSubtitleStream(player, true);

        const newStream = this.getSubtitleStream(player, index);

        if (!currentStream && !newStream) {
            return;
        }

        // Secondary subtitles are currently only handled client side
        // Changes to the server code are required before we can handle other delivery methods
        if (newStream && !this.trackHasSecondarySubtitleSupport(newStream, player)) {
            return;
        }

        try {
            player.setSecondarySubtitleStreamIndex(index);
            this._playerData(player).secondarySubtitleStreamIndex = index;
        } catch (e) {
            console.error('[playbackmanager] AutoSet - Failed to set secondary track:', e);
        }
    }

    seek(ticks, player) {
        ticks = Math.max(0, ticks);

        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.seek(ticks);
        }

        this._changeStream(player, ticks);
    }

    seekRelative(offsetTicks, player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player) && player.seekRelative) {
            return player.seekRelative(ticks);
        }

        const ticks = this._getCurrentTicks(player) + offsetTicks;
        return this.seek(ticks, player);
    }

    async play(options) {
        normalizePlayOptions(options);

        if (this._currentPlayer) {
            if (options.enableRemotePlayers === false && !this._currentPlayer.isLocalPlayer) {
                throw new Error('Remote players are disabled');
            }

            if (!this._currentPlayer.isLocalPlayer) {
                return this._currentPlayer.play(options);
            }
        }

        if (options.fullscreen) {
            loading.show();
        }

        let { items } = options;
        // If items were not passed directly, fetch them by ID
        if (!items) {
            if (!options.serverId) {
                throw new Error('serverId required!');
            }

            items = (await getItemsForPlayback(options.serverId, {
                ids: options.ids
            })).Items;
        }

        // Prepare the list of items
        items = await this._translateItemsForPlayback(items, options);
        // Add any additional parts for movies or episodes
        items = await this._getAdditionalParts(items, options.mediaSourceId, options.startIndex || 0);
        // Adjust the start index for additional parts added to the queue
        if (options.startIndex) {
            let adjustedStartIndex = 0;
            for (let i = 0; i < options.startIndex; i++) {
                adjustedStartIndex += items[i].length;
            }

            options.startIndex = adjustedStartIndex;
        }
        // getAdditionalParts returns an array of arrays of items, so flatten it
        items = items.flat();

        return this._playWithIntros(items, options);
    }

    getPlayerState(player, item, mediaSource) {
        player = player || this._currentPlayer;

        if (!player) {
            throw new Error('player cannot be null');
        }

        if (!enableLocalPlaylistManagement(player) && player.getPlayerState) {
            return player.getPlayerState();
        }

        item = item || this.currentItem(player);
        mediaSource = mediaSource || this.currentMediaSource(player);

        const state = {
            PlayState: {}
        };

        if (player) {
            state.PlayState.VolumeLevel = player.getVolume();
            state.PlayState.IsMuted = player.isMuted();
            state.PlayState.IsPaused = player.paused();
            state.PlayState.RepeatMode = this.getRepeatMode(player);
            state.PlayState.ShuffleMode = this.getQueueShuffleMode(player);
            state.PlayState.MaxStreamingBitrate = this.getMaxStreamingBitrate(player);

            state.PlayState.PositionTicks = this._getCurrentTicks(player);
            state.PlayState.PlaybackStartTimeTicks = this.playbackStartTime(player);
            state.PlayState.PlaybackRate = this.getPlaybackRate(player);

            state.PlayState.SubtitleStreamIndex = this.getSubtitleStreamIndex(player);
            state.PlayState.SecondarySubtitleStreamIndex = this.getSecondarySubtitleStreamIndex(player);
            state.PlayState.AudioStreamIndex = this.getAudioStreamIndex(player);
            state.PlayState.BufferedRanges = this.getBufferedRanges(player);

            state.PlayState.PlayMethod = this.playMethod(player);

            if (mediaSource) {
                state.PlayState.LiveStreamId = mediaSource.LiveStreamId;
            }
            state.PlayState.PlaySessionId = this.playSessionId(player);
            state.PlayState.PlaylistItemId = this.getCurrentPlaylistItemId(player);
        }

        if (mediaSource) {
            state.PlayState.MediaSourceId = mediaSource.Id;

            state.NowPlayingItem = {
                RunTimeTicks: mediaSource.RunTimeTicks
            };

            state.PlayState.CanSeek = (mediaSource.RunTimeTicks || 0) > 0 || this._canPlayerSeek(player);
        }

        if (item) {
            state.NowPlayingItem = getNowPlayingItemForReporting(player, item, mediaSource);
        }

        state.MediaSource = mediaSource;

        return state;
    }

    queue(options, player = this._currentPlayer) {
        return this._queue(options, '', player);
    }

    queueNext(options, player = this._currentPlayer) {
        return this._queue(options, 'next', player);
    }

    /**
     * Checks if:
     * - the track can be used directly as a secondary subtitle
     * - or if it can be paired with a secondary subtitle when used as a primary subtitle
     */
    _getCurrentSubtitleStream(player, isSecondaryStream = false) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        const index = isSecondaryStream ? this._playerData(player).secondarySubtitleStreamIndex : this._playerData(player).subtitleStreamIndex;

        if (index == null || index === -1) {
            return null;
        }

        return this.getSubtitleStream(player, index);
    }

    _removeCurrentPlayer(player) {
        const previousPlayer = this._currentPlayer;

        if (!previousPlayer || player.id === previousPlayer.id) {
            this._setCurrentPlayerInternal(null);
        }
    }

    _setCurrentPlayerInternal(player, targetInfo) {
        const previousPlayer = this._currentPlayer;
        const previousTargetInfo = this._currentTargetInfo;

        if (player && !targetInfo && player.isLocalPlayer) {
            targetInfo = createTarget(this, player);
        }

        if (player && !targetInfo) {
            throw new Error('targetInfo cannot be null');
        }

        this._currentPairingId = null;
        this._currentPlayer = player;
        this._currentTargetInfo = targetInfo;

        if (targetInfo) {
            console.debug('Active player: ' + JSON.stringify(targetInfo));
        }

        if (previousPlayer) {
            this.endPlayerUpdates(previousPlayer);
        }

        if (player) {
            this.beginPlayerUpdates(player);
        }

        triggerPlayerChange(this, player, targetInfo, previousPlayer, previousTargetInfo);
    }

    _getDefaultPlayOptions() {
        return {
            fullscreen: true
        };
    }

    _getSavedMaxStreamingBitrate(apiClient, mediaType) {
        if (!apiClient) {
            // This should hopefully never happen
            apiClient = ServerConnections.currentApiClient();
        }

        const endpointInfo = apiClient.getSavedEndpointInfo() || {};

        return appSettings.maxStreamingBitrate(endpointInfo.IsInNetwork, mediaType);
    }

    // Returns true if the player can seek using native client-side seeking functions
    _canPlayerSeek(player) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        const playerData = this._playerData(player);

        const currentSrc = (playerData.streamInfo.url || '').toLowerCase();

        if (currentSrc.indexOf('.m3u8') !== -1) {
            return true;
        }

        if (player.seekable) {
            return player.seekable();
        }

        const isPlayMethodTranscode = this.playMethod(player) === 'Transcode';

        if (isPlayMethodTranscode) {
            return false;
        }

        return player.duration();
    }

    _changeStream(player, ticks, params) {
        if (this._canPlayerSeek(player) && params == null) {
            player.currentTime(parseInt(ticks / 10000, 10));
            return;
        }

        params = params || {};

        const liveStreamId = this._playerData(player).streamInfo.liveStreamId;
        const lastMediaInfoQuery = this._playerData(player).streamInfo.lastMediaInfoQuery;

        const playSessionId = this.playSessionId(player);

        const currentItem = this.currentItem(player);

        player.getDeviceProfile(currentItem, {
            isRetry: params.EnableDirectPlay === false
        }).then((deviceProfile) => {
            const audioStreamIndex = params.AudioStreamIndex == null ? this._playerData(player).audioStreamIndex : params.AudioStreamIndex;
            const subtitleStreamIndex = params.SubtitleStreamIndex == null ? this._playerData(player).subtitleStreamIndex : params.SubtitleStreamIndex;
            const secondarySubtitleStreamIndex = params.SecondarySubtitleStreamIndex == null ? this._playerData(player).secondarySubtitleStreamIndex : params.SecondarySubtitleStreamIndex;

            let currentMediaSource = this.currentMediaSource(player);
            const apiClient = ServerConnections.getApiClient(currentItem.ServerId);

            if (ticks) {
                ticks = parseInt(ticks, 10);
            }

            const maxBitrate = params.MaxStreamingBitrate || this.getMaxStreamingBitrate(player);

            const currentPlayOptions = currentItem.playOptions || this._getDefaultPlayOptions();

            const options = {
                maxBitrate,
                startPosition: ticks,
                isPlayback: true,
                audioStreamIndex,
                subtitleStreamIndex,
                enableDirectPlay: params.EnableDirectPlay,
                enableDirectStream: params.EnableDirectStream,
                allowVideoStreamCopy: params.AllowVideoStreamCopy,
                allowAudioStreamCopy: params.AllowAudioStreamCopy
            };

            getPlaybackInfo(player, getMediaContext(currentItem.ServerId), currentItem, deviceProfile, currentMediaSource.Id, liveStreamId, options).then((result) => {
                if (validatePlaybackInfoResult(result)) {
                    currentMediaSource = result.MediaSources[0];

                    const streamInfo = this._createStreamInfo(apiClient, currentItem.MediaType, currentItem, currentMediaSource, ticks, player);
                    streamInfo.fullscreen = currentPlayOptions.fullscreen;
                    streamInfo.lastMediaInfoQuery = lastMediaInfoQuery;
                    streamInfo.resetSubtitleOffset = false;

                    if (!streamInfo.url) {
                        this._cancelPlayback();
                        showPlaybackInfoErrorMessage(`PlaybackError.${MediaError.NO_MEDIA_ERROR}`);
                        return;
                    }

                    this._playerData(player).subtitleStreamIndex = subtitleStreamIndex;
                    this._playerData(player).secondarySubtitleStreamIndex = secondarySubtitleStreamIndex;
                    this._playerData(player).audioStreamIndex = audioStreamIndex;
                    this._playerData(player).maxStreamingBitrate = maxBitrate;

                    this._changeStreamToUrl(apiClient, player, playSessionId, streamInfo);
                }
            });
        });
    }

    _changeStreamToUrl(apiClient, player, playSessionId, streamInfo) {
        const playerData = this._playerData(player);

        playerData.isChangingStream = true;

        if (playerData.streamInfo && playSessionId) {
            apiClient.stopActiveEncodings(playSessionId).then(() => {
                // Stop the first transcoding afterwards because the player may still send requests to the original url
                const afterSetSrc = function () {
                    apiClient.stopActiveEncodings(playSessionId);
                };
                this._setSrcIntoPlayer(apiClient, player, streamInfo).then(afterSetSrc, afterSetSrc);
            });
        } else {
            this._setSrcIntoPlayer(apiClient, player, streamInfo);
        }
    }

    _setSrcIntoPlayer(apiClient, player, streamInfo) {
        const playerData = this._playerData(player);

        playerData.streamInfo = streamInfo;

        return player.play(streamInfo).then(() => {
            playerData.isChangingStream = false;
            streamInfo.started = true;
            streamInfo.ended = false;

            this._sendProgressUpdate(player, 'timeupdate');
        }, (e) => {
            playerData.isChangingStream = false;

            this._onPlaybackError(player, e, {
                type: getMediaError(e),
                streamInfo
            });
        });
    }

    async _translateItemsForPlayback(items, options) {
        if (!items.length) return [];

        this._sortItemsIfNeeded(items, options);

        const firstItem = items[0];
        const serverId = firstItem.ServerId;
        const queryOptions = options.queryOptions || {};

        const promise = this._getPlaybackPromise(firstItem, serverId, options, queryOptions, items);

        if (promise) {
            const result = await promise;
            return result ? result.Items : items;
        } else {
            return items;
        }
    }

    _sortItemsIfNeeded(items, options) {
        if (items.length > 1 && options?.ids) {
            // Use the original request id array for sorting the result in the proper order
            items.sort(function (a, b) {
                return options.ids.indexOf(a.Id) - options.ids.indexOf(b.Id);
            });
        }
    }

    _getPlaybackPromise(firstItem, serverId, options, queryOptions, items) {
        const sortBy = options.shuffle ? [ItemSortBy.Random] : [ItemSortBy.SortName];

        switch (firstItem.Type) {
            case BaseItemKind.Program:
                return getItemsForPlayback(serverId, {
                    ids: [firstItem.ChannelId]
                });
            case BaseItemKind.Playlist:
                return getItemsForPlayback(serverId, {
                    parentId: firstItem.Id,
                    sortBy: options.shuffle ? sortBy : undefined
                });
            case BaseItemKind.MusicArtist:

                return getItemsForPlayback(serverId, mergePlaybackQueries({
                    artistIds: [firstItem.Id],
                    recursive: true,
                    sortBy: options.shuffle ? sortBy : [
                        ItemSortBy.Album,
                        ItemSortBy.ParentIndexNumber,
                        ItemSortBy.IndexNumber,
                        ItemSortBy.SortName
                    ],
                    mediaTypes: [MediaType.Audio]
                }, queryOptions));
            case BaseItemKind.PhotoAlbum:
                return getItemsForPlayback(serverId, mergePlaybackQueries({
                    parentId: firstItem.Id,
                    // Setting this to true may cause some incorrect sorting
                    recursive: false,
                    sortBy,
                    // Only include Photos because we do not handle mixed queues currently
                    mediaTypes: [MediaType.Photo],
                    limit: UNLIMITED_ITEMS
                }, queryOptions));
            case BaseItemKind.MusicGenre:
                return getItemsForPlayback(serverId, mergePlaybackQueries({
                    genreIds: [firstItem.Id],
                    recursive: true,
                    sortBy,
                    mediaTypes: [MediaType.Audio]
                }, queryOptions));
            case BaseItemKind.Genre:
                return getItemsForPlayback(serverId, mergePlaybackQueries({
                    genreIds: [firstItem.Id],
                    parentId: firstItem.ParentId,
                    recursive: true,
                    sortBy,
                    mediaTypes: [MediaType.Video]
                }, queryOptions));
            case BaseItemKind.Studio:
                return getItemsForPlayback(serverId, mergePlaybackQueries({
                    studioIds: [firstItem.Id],
                    recursive: true,
                    sortBy,
                    mediaTypes: [MediaType.Video]
                }, queryOptions));
            case BaseItemKind.Person:
                return getItemsForPlayback(serverId, mergePlaybackQueries({
                    personIds: [firstItem.Id],
                    parentId: firstItem.ParentId,
                    recursive: true,
                    sortBy,
                    mediaTypes: [MediaType.Video]
                }, queryOptions));
            case BaseItemKind.Series:
            case BaseItemKind.Season:
                return this._getSeriesOrSeasonPlaybackPromise(firstItem, options, items);
            case BaseItemKind.Episode:
                return this._getEpisodePlaybackPromise(firstItem, options, items);
        }

        return this._getNonItemTypePromise(firstItem, serverId, options, queryOptions);
    }

    _getNonItemTypePromise(firstItem, serverId, options, queryOptions) {
        const sortBy = options.shuffle ? [ItemSortBy.Random] : [ItemSortBy.SortName];

        if (firstItem.MediaType === 'Photo') {
            return getItemsForPlayback(serverId, mergePlaybackQueries({
                parentId: firstItem.ParentId,
                filters: [ItemFilter.IsNotFolder],
                // Setting this to true may cause some incorrect sorting
                recursive: false,
                sortBy,
                mediaTypes: [MediaType.Photo, MediaType.Video],
                limit: UNLIMITED_ITEMS
            }, queryOptions)).then(function (result) {
                const playbackItems = result.Items;

                let index = playbackItems.map(function (i) {
                    return i.Id;
                }).indexOf(firstItem.Id);

                if (index === -1) {
                    index = 0;
                }

                options.startIndex = index;

                return Promise.resolve(result);
            });
        } else if (firstItem.IsFolder && firstItem.CollectionType === 'homevideos') {
            return getItemsForPlayback(serverId, mergePlaybackQueries({
                parentId: firstItem.Id,
                filters: [ItemFilter.IsNotFolder],
                recursive: true,
                sortBy,
                // Only include Photos because we do not handle mixed queues currently
                mediaTypes: [MediaType.Photo],
                limit: UNLIMITED_ITEMS
            }, queryOptions));
        } else if (firstItem.IsFolder && firstItem.CollectionType === 'musicvideos') {
            return getItemsForPlayback(serverId, mergePlaybackQueries({
                parentId: firstItem.Id,
                filters: [ItemFilter.IsNotFolder],
                recursive: true,
                sortBy,
                mediaTypes: [MediaType.Video],
                limit: UNLIMITED_ITEMS
            }, queryOptions));
        } else if (firstItem.IsFolder) {
            let folderSortBy;
            if (options.shuffle) {
                folderSortBy = [ItemSortBy.Random];
            } else if (firstItem.Type !== 'BoxSet') {
                if (firstItem.CollectionType === 'music' || firstItem.MediaType === 'Audio') {
                    folderSortBy = [
                        ItemSortBy.Album,
                        ItemSortBy.ParentIndexNumber,
                        ItemSortBy.IndexNumber,
                        ItemSortBy.SortName
                    ];
                } else {
                    folderSortBy = [ItemSortBy.SortName];
                }
            }

            return getItemsForPlayback(serverId, mergePlaybackQueries({
                parentId: firstItem.Id,
                filters: [ItemFilter.IsNotFolder],
                recursive: true,
                // These are pre-sorted
                sortBy: folderSortBy,
                mediaTypes: [MediaType.Audio, MediaType.Video]
            }, queryOptions));
        }

        return null;
    }

    async _getSeriesOrSeasonPlaybackPromise(firstItem, options, items) {
        const apiClient = ServerConnections.getApiClient(firstItem.ServerId);
        const startSeasonId = firstItem.Type === 'Season' ? items[options.startIndex || 0].Id : undefined;

        const seasonId = (startSeasonId && items.length === 1) ? startSeasonId : undefined;
        const SeriesId = firstItem.SeriesId || firstItem.Id;
        const UserId = apiClient.getCurrentUserId();

        let startItemId;

        // Start from a specific (the next unwatched) episode if we want to watch in order and have not chosen a specific season
        if (!options.shuffle && !seasonId) {
            const nextUp = await apiClient.getNextUpEpisodes({ SeriesId, UserId });
            startItemId = nextUp?.Items?.[0]?.Id;
        }

        const episodesResult = await apiClient.getEpisodes(SeriesId, {
            IsVirtualUnaired: false,
            IsMissing: false,
            SeasonId: seasonId,
            // default to first 100 episodes if no season was specified to avoid loading too large payloads
            limit: seasonId ? undefined : 100,
            SortBy: options.shuffle ? 'Random' : undefined,
            UserId,
            Fields: ['Chapters', 'Trickplay'],
            startItemId
        });

        if (options.shuffle) {
            episodesResult.StartIndex = 0;
        } else {
            episodesResult.StartIndex = undefined;
            let seasonStartIndex;
            for (const [index, e] of episodesResult.Items.entries()) {
                if (startSeasonId && items.length != 1) {
                    if (e.SeasonId == startSeasonId) {
                        if (seasonStartIndex === undefined) {
                            seasonStartIndex = index;
                        }
                    } else {
                        continue;
                    }
                }
                if (!e.UserData.Played) {
                    episodesResult.StartIndex = index;
                    break;
                }
            }
            episodesResult.StartIndex = episodesResult.StartIndex || seasonStartIndex || 0;
        }

        // El índice de arranque se copia a las opciones porque toda la
        // cadena posterior (getAdditionalParts, playWithIntros, la cola)
        // lee `options.startIndex`, no el resultado. Unificarlo obliga a
        // tocar esos cuatro sitios a la vez.
        options.startIndex = episodesResult.StartIndex;

        episodesResult.TotalRecordCount = episodesResult.Items.length;

        return episodesResult;
    }

    _getEpisodePlaybackPromise(firstItem, options, items) {
        if (items.length === 1 && this._getPlayer(firstItem, options).supportsProgress !== false) {
            return this._getEpisodes(firstItem, options);
        } else {
            return null;
        }
    }

    _getEpisodes(firstItem, options) {
        return new Promise((resolve, reject) => {
            const apiClient = ServerConnections.getApiClient(firstItem.ServerId);

            const { SeriesId, Id } = firstItem;
            if (!SeriesId) {
                resolve(null);
                return;
            }

            apiClient.getEpisodes(SeriesId, {
                IsVirtualUnaired: false,
                IsMissing: false,
                UserId: apiClient.getCurrentUserId(),
                Fields: ['Chapters', 'Trickplay'],
                // limit to loading 100 episodes to avoid loading too large payload
                limit: 100,
                startItemId: Id
            }).then(function (episodesResult) {
                resolve(this._filterEpisodes(episodesResult, firstItem, options));
            }, reject);
        });
    }

    _filterEpisodes(episodesResult, firstItem, options) {
        for (const [index, e] of episodesResult.Items.entries()) {
            if (e.Id === firstItem.Id) {
                episodesResult.StartIndex = index;
                break;
            }
        }

        // Ver la nota de filterEpisodes: la cadena posterior lee
        // `options.startIndex`, no el resultado.
        options.startIndex = episodesResult.StartIndex;
        episodesResult.TotalRecordCount = episodesResult.Items.length;
        return episodesResult;
    }

    _getCurrentTicks(player) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        let playerTime = Math.floor(10000 * (player).currentTime());

        const streamInfo = this._playerData(player).streamInfo;
        if (streamInfo) {
            playerTime += this._playerData(player).streamInfo.transcodingOffsetTicks || 0;
        }

        return playerTime;
    }

    _playOther(items, options) {
        const playStartIndex = options.startIndex || 0;
        const player = this._getPlayer(items[playStartIndex], options);

        loading.hide();

        options.items = items;

        return player.play(options);
    }

    async _getAdditionalParts(items, mediaSourceId, startIndex) {
        const getItemAndParts = async function (item, isStartItem) {
            if (
                item.PartCount && item.PartCount > 1
                && [ BaseItemKind.Episode, BaseItemKind.Movie ].includes(item.Type)
            ) {
                const client = ServerConnections.getApiClient(item.ServerId);
                const user = await client.getCurrentUser();
                // When the user picked an alternate version, that version's MediaSourceId
                // equals its own BaseItem.Id, so use it to fetch the alternate's own
                // additional parts instead of the primary's - otherwise the primary's
                // stack parts would queue after the alternate finishes.
                const idForParts = (isStartItem && mediaSourceId && mediaSourceId !== item.Id) ?
                    mediaSourceId :
                    item.Id;
                const additionalParts = await client.getAdditionalVideoParts(user.Id, idForParts);
                if (additionalParts.Items.length) {
                    return [ item, ...additionalParts.Items ];
                }
            }
            return [ item ];
        };

        return Promise.all(items.map((item, index) => getItemAndParts(item, index === (startIndex || 0))));
    }

    _playWithIntros(items, options) {
        let playStartIndex = options.startIndex || 0;
        let firstItem = items[playStartIndex];

        // If index was bad, reset it
        if (!firstItem) {
            playStartIndex = 0;
            firstItem = items[playStartIndex];
        }

        // If it's still null then there's nothing to play
        if (!firstItem) {
            showPlaybackInfoErrorMessage(`PlaybackError.${MediaError.NO_MEDIA_ERROR}`);
            return Promise.reject();
        }

        if (firstItem.MediaType === 'Photo' || firstItem.MediaType === 'Book') {
            return this._playOther(items, options);
        }

        return getIntros(firstItem, ServerConnections.getApi(firstItem.ServerId), options).then((introsResult) => {
            const introItems = introsResult.Items;
            let introPlayOptions;

            firstItem.playOptions = truncatePlayOptions(options);

            if (introItems.length) {
                introPlayOptions = {
                    fullscreen: firstItem.playOptions.fullscreen
                };
            } else {
                introPlayOptions = firstItem.playOptions;
            }

            items = introItems.concat(items);

            // Needed by players that manage their own playlist
            introPlayOptions.items = items;
            introPlayOptions.startIndex = playStartIndex;

            return this._playInternal(items[playStartIndex], introPlayOptions, () => {
                this._playQueueManager.setPlaylist(items);

                this._setPlaylistState(items[playStartIndex].PlaylistItemId, playStartIndex);
                loading.hide();
            });
        });
    }

    // Set playlist state. Using a method allows for overloading in derived player implementations
    _setPlaylistState(playlistItemId, index) {
        if (!isNaN(index)) {
            this._playQueueManager.setPlaylistState(playlistItemId, index);
        }
    }

    _playInternal(item, playOptions, onPlaybackStartedFn, prevSource) {
        if (item.IsPlaceHolder) {
            loading.hide();
            showPlaybackInfoErrorMessage('PlaybackErrorPlaceHolder');
            return Promise.reject();
        }

        // Normalize defaults to simplfy checks throughout the process
        normalizePlayOptions(playOptions);

        playOptions.isFirstItem = playOptions.isFirstItem || !prevSource;

        // Se usa el tipo del item, no el que se pidió reproducir. Se nota
        // al pedir solo el audio de un vídeo (por ejemplo un videoclip en
        // una lista de música): se elige player y perfil de vídeo. Para
        // arreglarlo hay que propagar `playOptions.mediaType` desde quien
        // inicia la reproducción, que hoy no lo manda.
        const mediaType = item.MediaType;

        return this._runInterceptors(item, playOptions)
            .catch(() => this._onInterceptorRejection())
            .then(() => {
                if (playOptions.fullscreen) {
                    loading.show();
                }
            })
            .then(() => this._detectBitrate(item, mediaType))
            .then((bitrate) => {
                return this._playAfterBitrateDetect(bitrate, item, playOptions, onPlaybackStartedFn, prevSource)
                    .catch((e) => this._onPlaybackRejection(e));
            })
            .catch((err) => {
                if (playOptions.fullscreen) {
                    loading.hide();
                }
                // Este catch recoge tanto los rechazos previstos (el
                // usuario cancela, un interceptor deniega) como los
                // errores de programación. Sin registrarlo, un fallo
                // dentro de la cadena deja la reproducción muerta y la
                // consola vacía.
                if (err) console.error('[playbackmanager] la reproducción no arrancó', err);
            });
    }

    _cancelPlayback() {
        const player = this._currentPlayer;

        if (player) {
            this._destroyPlayer(player);
            this._removeCurrentPlayer(player);
        }

        Events.trigger(this, 'playbackcancelled');
    }

    _onInterceptorRejection() {
        this._cancelPlayback();

        return Promise.reject();
    }

    _onPlaybackRejection(e) {
        this._cancelPlayback();

        // El error original se pierde al traducirlo a un código de la UI;
        // sin registrarlo aquí, un fallo dentro de la cadena solo se ve
        // como un "error desconocido" en pantalla.
        console.error('[playbackmanager] la reproducción falló', e);

        let displayErrorCode = 'ErrorDefault';

        if (e instanceof Response) {
            if (e.status >= 500) {
                displayErrorCode = `PlaybackError.${MediaError.SERVER_ERROR}`;
            } else if (e.status >= 400) {
                displayErrorCode = `PlaybackError.${MediaError.NO_MEDIA_ERROR}`;
            }
        }

        showPlaybackInfoErrorMessage(displayErrorCode);

        return Promise.reject();
    }

    _destroyPlayer(player) {
        player.destroy();
    }

    _runInterceptors(item, playOptions) {
        return new Promise((resolve, reject) => {
            const interceptors = pluginManager.ofType(PluginType.PreplayIntercept);

            interceptors.sort(function (a, b) {
                return (a.priority || 0) - (b.priority || 0);
            });

            if (!interceptors.length) {
                resolve();
                return;
            }

            const options = Object.assign({}, playOptions);

            options.mediaType = item.MediaType;
            options.item = item;

            this._runNextPrePlay(interceptors, 0, options, resolve, reject);
        });
    }

    _runNextPrePlay(interceptors, index, options, resolve, reject) {
        if (index >= interceptors.length) {
            resolve();
            return;
        }

        const interceptor = interceptors[index];

        interceptor.intercept(options).then(() => {
            this._runNextPrePlay(interceptors, index + 1, options, resolve, reject);
        }, reject);
    }

    _sendPlaybackListToPlayer(player, items, deviceProfile, mediaContext, mediaSourceId, options) {
        setStreamUrls(items, deviceProfile, options.maxBitrate, mediaContext, options.startPosition);
        loading.hide();

        return player.play({
            items,
            startPositionTicks: options.startPosition || 0,
            mediaSourceId,
            audioStreamIndex: options.audioStreamIndex,
            subtitleStreamIndex: options.subtitleStreamIndex,
            startIndex: options.startIndex
        });
    }

    _detectBitrate(item, mediaType) {
        const api = ServerConnections.getApi(item.ServerId);
        const apiClient = ServerConnections.getApiClient(item.ServerId);

        // La cadena arranca con un Promise.resolve() vacío para poder
        // usar `reject` como "salta la detección" y recogerlo abajo en un
        // único catch. Es un goto disfrazado, pero reescribirlo con
        // async/await cambia el orden en que se resuelven los timeouts de
        // la prueba de ancho de banda, así que se deja y se explica.
        return Promise.resolve()
            .then(() => {
                if (!isServerItem(item) || itemHelper.isLocalItem(item)) {
                    return Promise.reject(new Error('skip bitrate detection'));
                }

                return apiClient.getEndpointInfo()
                    .then((endpointInfo) => {
                        if ((mediaType === 'Video' || mediaType === 'Audio') && appSettings.enableAutomaticBitrateDetection(endpointInfo.IsInNetwork, mediaType)) {
                            return bitrateTest.detectBitrate(api)
                                .then((bitrate) => {
                                    appSettings.maxStreamingBitrate(endpointInfo.IsInNetwork, mediaType, bitrate);
                                    return bitrate;
                                });
                        }

                        return Promise.reject(new Error('skip bitrate detection'));
                    });
            })
            .catch(() => this._getSavedMaxStreamingBitrate(apiClient, mediaType));
    }

    _playAfterBitrateDetect(maxBitrate, item, playOptions, onPlaybackStartedFn, prevSource) {
        const startPosition = playOptions.startPositionTicks;

        const player = this._getPlayer(item, playOptions);
        const activePlayer = this._currentPlayer;

        let promise;

        if (activePlayer) {
            // Limitación conocida: al cambiar de player dentro de la
            // misma lista esto deja `nextItem` en null, así que el
            // "siguiente" no se anuncia hasta que arranca la pista.
            this._playNextAfterEnded = false;
            promise = this._onPlaybackChanging(activePlayer, player, item);
        } else {
            promise = Promise.resolve();
        }

        if (!player) {
            return promise.then(() => {
                this._cancelPlayback();
                loading.hide();
                console.error(`No player found for the requested media: ${item.Url}`);
                showPlaybackInfoErrorMessage('ErrorPlayerNotFound');
            });
        }

        if (!isServerItem(item) || item.MediaType === 'Book') {
            return promise.then(() => {
                const streamInfo = createStreamInfoFromUrlItem(item);
                streamInfo.fullscreen = playOptions.fullscreen;
                this._playerData(player).isChangingStream = false;
                return player.play(streamInfo).then(() => {
                    loading.hide();
                    onPlaybackStartedFn();
                    this._onPlaybackStarted(player, playOptions, streamInfo);
                }).catch((errorCode) => {
                    this.stop(player);
                    loading.hide();
                    showPlaybackInfoErrorMessage(errorCode || 'ErrorDefault');
                });
            });
        }

        let mediaSourceId = playOptions.mediaSourceId;

        const apiClient = ServerConnections.getApiClient(item.ServerId);
        const isLiveTv = [BaseItemKind.TvChannel, BaseItemKind.LiveTvChannel].includes(item.Type);
        const getMediaStreams = isLiveTv ? Promise.resolve([]) : apiClient.getItem(apiClient.getCurrentUserId(), mediaSourceId || item.Id)
            .then(fullItem => {
                return fullItem.MediaStreams;
            });

        return Promise.all([promise, player.getDeviceProfile(item), apiClient.getCurrentUser(), getMediaStreams]).then((responses) => {
            const deviceProfile = responses[1];
            const user = responses[2];
            const mediaStreams = responses[3];

            const audioStreamIndex = playOptions.audioStreamIndex;
            const subtitleStreamIndex = playOptions.subtitleStreamIndex;
            const options = {
                aspectRatio: playOptions.aspectRatio,
                maxBitrate,
                startPosition,
                isPlayback: null,
                audioStreamIndex,
                subtitleStreamIndex,
                startIndex: playOptions.startIndex,
                enableDirectPlay: null,
                enableDirectStream: null,
                allowVideoStreamCopy: null,
                allowAudioStreamCopy: null
            };

            if (player && !enableLocalPlaylistManagement(player)) {
                return this._sendPlaybackListToPlayer(player, playOptions.items, deviceProfile, getMediaContext(item.ServerId), mediaSourceId, options);
            }

            // this reference was only needed by sendPlaybackListToPlayer
            playOptions.items = null;

            const trackOptions = {};
            let isIdFallbackNeeded = false;

            autoSetNextTracks(prevSource, mediaStreams, trackOptions, user.Configuration.RememberAudioSelections, user.Configuration.RememberSubtitleSelections);
            if (trackOptions.DefaultAudioStreamIndex != null) {
                options.audioStreamIndex = trackOptions.DefaultAudioStreamIndex;
                isIdFallbackNeeded = true;
            }
            if (trackOptions.DefaultSubtitleStreamIndex != null) {
                options.subtitleStreamIndex = trackOptions.DefaultSubtitleStreamIndex;
                isIdFallbackNeeded = true;
            }

            if (isIdFallbackNeeded) {
                mediaSourceId ||= item.Id;
            }

            return this._getPlaybackMediaSource(player, getMediaContext(item.ServerId), deviceProfile, item, mediaSourceId, options).then(async (mediaSource) => {
                if (trackOptions.DefaultSecondarySubtitleStreamIndex != null) {
                    mediaSource.DefaultSecondarySubtitleStreamIndex = trackOptions.DefaultSecondarySubtitleStreamIndex;
                }

                if (mediaSource.DefaultSubtitleStreamIndex == null || mediaSource.DefaultSubtitleStreamIndex < 0) {
                    if (mediaSource.DefaultSecondarySubtitleStreamIndex != null) {
                        mediaSource.DefaultSubtitleStreamIndex = mediaSource.DefaultSecondarySubtitleStreamIndex;
                    }
                    mediaSource.DefaultSecondarySubtitleStreamIndex = -1;
                }

                const subtitleTrack1 = mediaSource.MediaStreams[mediaSource.DefaultSubtitleStreamIndex];
                const subtitleTrack2 = mediaSource.MediaStreams[mediaSource.DefaultSecondarySubtitleStreamIndex];

                if (!this.trackHasSecondarySubtitleSupport(subtitleTrack1, player)
                    || !this.trackHasSecondarySubtitleSupport(subtitleTrack2, player)) {
                    mediaSource.DefaultSecondarySubtitleStreamIndex = -1;
                }

                const streamInfo = this._createStreamInfo(apiClient, item.MediaType, item, mediaSource, startPosition, player);
                streamInfo.aspectRatio = playOptions.aspectRatio;
                streamInfo.fullscreen = playOptions.fullscreen;

                const playerData = this._playerData(player);

                playerData.isChangingStream = false;
                playerData.maxStreamingBitrate = maxBitrate;
                playerData.streamInfo = streamInfo;

                return player.play(streamInfo).then(() => {
                    loading.hide();
                    onPlaybackStartedFn();
                    this._onPlaybackStarted(player, playOptions, streamInfo, mediaSource);
                }, (err) => {
                    // Se informa del inicio aunque haya fallado: el resto
                    // del sistema (OSD, sesión en el servidor, reintento
                    // con transcodificación) da por hecho que hubo un
                    // start antes de poder tratar el error. Quitarlo sin
                    // más deja la sesión colgada en el servidor.
                    onPlaybackStartedFn();
                    this._onPlaybackStarted(player, playOptions, streamInfo, mediaSource);
                    setTimeout(() => {
                        this._onPlaybackError(player, err, {
                            type: getMediaError(err),
                            streamInfo
                        });
                    }, 100);
                });
            });
        });
    }

    _createStreamInfo(apiClient, type, item, mediaSource, startPosition, player) {
        let mediaUrl;
        let contentType;
        let transcodingOffsetTicks = 0;
        const playerStartPositionTicks = startPosition;
        const liveStreamId = mediaSource.LiveStreamId;

        let playMethod = 'Transcode';

        const mediaSourceContainer = (mediaSource.Container || '').toLowerCase();
        let directOptions;

        if (mediaSource.MediaStreams && player.useFullSubtitleUrls) {
            mediaSource.MediaStreams.forEach(stream => {
                if (stream.DeliveryUrl?.startsWith('/')) {
                    stream.DeliveryUrl = apiClient.getUrl(stream.DeliveryUrl);
                }
            });
        }

        if (type === 'Video' || type === 'Audio') {
            contentType = getMimeType(type.toLowerCase(), mediaSourceContainer);

            if (mediaSource.enableDirectPlay) {
                mediaUrl = mediaSource.Path;

                playMethod = 'DirectPlay';
            } else if (mediaSource.StreamUrl) {
                // Only used for audio
                mediaUrl = mediaSource.StreamUrl;
                // Use the default playMethod value of Transcode
            } else if (mediaSource.SupportsDirectPlay || mediaSource.SupportsDirectStream) {
                directOptions = {
                    Static: true,
                    mediaSourceId: mediaSource.Id,
                    deviceId: apiClient.deviceId(),
                    ApiKey: apiClient.accessToken()
                };

                if (mediaSource.ETag) {
                    directOptions.Tag = mediaSource.ETag;
                }

                if (mediaSource.LiveStreamId) {
                    directOptions.LiveStreamId = mediaSource.LiveStreamId;
                }

                const prefix = type === 'Video' ? 'Videos' : 'Audio';
                mediaUrl = apiClient.getUrl(prefix + '/' + item.Id + '/stream.' + mediaSourceContainer, directOptions);

                playMethod = mediaSource.SupportsDirectPlay ? 'DirectPlay' : 'DirectStream';
            } else if (mediaSource.SupportsTranscoding) {
                mediaUrl = apiClient.getUrl(mediaSource.TranscodingUrl);

                if (mediaSource.TranscodingSubProtocol === 'hls') {
                    contentType = 'application/x-mpegURL';
                } else {
                    contentType = getMimeType(type.toLowerCase(), mediaSource.TranscodingContainer);

                    if (mediaUrl.toLowerCase().indexOf('copytimestamps=true') === -1) {
                        transcodingOffsetTicks = startPosition || 0;
                    }
                }
            }
        } else {
            // All other media types
            mediaUrl = mediaSource.Path;
            playMethod = 'DirectPlay';
        }

        // Fallback (used for offline items)
        if (!mediaUrl && mediaSource.SupportsDirectPlay) {
            mediaUrl = mediaSource.Path;
            playMethod = 'DirectPlay';
        }

        // Se calculan una sola vez: antes se llamaba dos veces a
        // getTextTracks para rellenar `textTracks` y un `tracks` duplicado
        // que no leía nadie.
        const textTracks = this._getTextTracks(apiClient, item, mediaSource);

        const resultInfo = {
            url: mediaUrl,
            mimeType: contentType,
            transcodingOffsetTicks: transcodingOffsetTicks,
            playMethod: playMethod,
            playerStartPositionTicks: playerStartPositionTicks,
            item: item,
            mediaSource: mediaSource,
            textTracks,
            mediaType: type,
            liveStreamId: liveStreamId,
            playSessionId: getUrlParameter(mediaUrl, 'playSessionId'),
            title: item.Name
        };

        const backdropUrl = getItemBackdropImageUrl(ServerConnections.getApi(item.ServerId), item, {}, true);
        if (backdropUrl) {
            resultInfo.backdropUrl = backdropUrl;
        }

        return resultInfo;
    }

    _getTextTracks(apiClient, item, mediaSource) {
        const subtitleStreams = mediaSource.MediaStreams.filter(function (s) {
            return s.Type === 'Subtitle';
        });

        const textStreams = subtitleStreams.filter(function (s) {
            return s.DeliveryMethod === 'External';
        });

        const tracks = [];

        for (let i = 0, length = textStreams.length; i < length; i++) {
            const textStream = textStreams[i];
            let textStreamUrl;

            if (itemHelper.isLocalItem(item)) {
                textStreamUrl = textStream.Path;
            } else {
                textStreamUrl = !textStream.IsExternalUrl ? apiClient.getUrl(textStream.DeliveryUrl) : textStream.DeliveryUrl;
            }

            tracks.push({
                url: textStreamUrl,
                language: (textStream.Language || 'und'),
                isDefault: textStream.Index === mediaSource.DefaultSubtitleStreamIndex,
                index: textStream.Index,
                format: textStream.Codec
            });
        }

        return tracks;
    }

    _getPlaybackMediaSource(player, mediaContext, deviceProfile, item, mediaSourceId, options) {
        options.isPlayback = true;

        return getPlaybackInfo(player, mediaContext, item, deviceProfile, mediaSourceId, null, options).then(function (playbackInfoResult) {
            if (validatePlaybackInfoResult(playbackInfoResult)) {
                return getOptimalMediaSource(mediaContext, item, playbackInfoResult.MediaSources).then(function (mediaSource) {
                    if (mediaSource) {
                        if (mediaSource.RequiresOpening && !mediaSource.LiveStreamId) {
                            options.audioStreamIndex = null;
                            options.subtitleStreamIndex = null;

                            return getLiveStream(player, mediaContext, item, playbackInfoResult.PlaySessionId, deviceProfile, mediaSource, options).then(function (openLiveStreamResult) {
                                return supportsDirectPlay(mediaContext, item, openLiveStreamResult.MediaSource).then(function (result) {
                                    openLiveStreamResult.MediaSource.enableDirectPlay = result;
                                    return openLiveStreamResult.MediaSource;
                                });
                            });
                        } else {
                            if (item.AlbumId != null) {
                                return getLibraryApi(mediaContext.api).getItem({
                                    itemId: item.AlbumId,
                                    userId: mediaContext.userId
                                }).then(function ({ data: album }) {
                                    mediaSource.albumNormalizationGain = album.NormalizationGain;
                                    return mediaSource;
                                });
                            }
                            return mediaSource;
                        }
                    } else {
                        showPlaybackInfoErrorMessage(`PlaybackError.${MediaError.NO_MEDIA_ERROR}`);
                        return Promise.reject();
                    }
                });
            } else {
                return Promise.reject();
            }
        });
    }

    _getPlayer(item, playOptions, forceLocalPlayers) {
        const serverItem = isServerItem(item);
        return getAutomaticPlayers(this, forceLocalPlayers).filter(function (p) {
            if (p.canPlayMediaType(item.MediaType)) {
                if (serverItem) {
                    if (p.canPlayItem) {
                        return p.canPlayItem(item, playOptions);
                    }
                    return true;
                } else if (item.Url && p.canPlayUrl) {
                    return p.canPlayUrl(item.Url);
                }
            }

            return false;
        })[0];
    }

    _getPreviousSource(player) {
        const prevSource = this.currentMediaSource(player);
        const prevPlayerData = this._playerData(player);
        return {
            ...prevSource,
            DefaultAudioStreamIndex: prevPlayerData.audioStreamIndex,
            DefaultSubtitleStreamIndex: prevPlayerData.subtitleStreamIndex,
            DefaultSecondarySubtitleStreamIndex: prevPlayerData.secondarySubtitleStreamIndex
        };
    }

    _queue(options, mode, player) {
        player = player || this._currentPlayer;

        if (!player) {
            return this.play(options);
        }

        // `options.startIndex` se ignora al encolar: encolar añade al
        // final de la cola, no arranca nada, así que no hay "empezar por
        // el elemento N". En los pases de fotos sí tendría sentido —el
        // pase empieza por la foto que se pulsó— pero eso hoy va por
        // `play()`, no por aquí.
        if (options.items) {
            return this._translateItemsForPlayback(options.items, options)
                .then((items) => this._queueAll(items, mode, player));
        }

        if (!options.serverId) {
            throw new Error('serverId required!');
        }

        return getItemsForPlayback(options.serverId, {
            ids: options.ids
        })
            .then((result) => this._translateItemsForPlayback(result.Items, options))
            .then((items) => this._queueAll(items, mode, player));
    }

    _queueAll(items, mode, player) {
        if (!items.length) {
            return;
        }

        if (!player.isLocalPlayer) {
            if (mode === 'next') {
                player.queueNext({
                    items: items
                });
            } else {
                player.queue({
                    items: items
                });
            }
            return;
        }

        const queueDirectToPlayer = player && !enableLocalPlaylistManagement(player);

        if (queueDirectToPlayer) {
            player.getDeviceProfile(items[0]).then((profile) => {
                setStreamUrls(items, profile, this.getMaxStreamingBitrate(player), getMediaContext(items[0].ServerId), 0);
                if (mode === 'next') {
                    player.queueNext(items);
                } else {
                    player.queue(items);
                }
            });

            return;
        }

        if (mode === 'next') {
            this._playQueueManager.queueNext(items);
        } else {
            this._playQueueManager.queue(items);
        }
        Events.trigger(player, 'playlistitemadd');
    }

    // Latido de progreso: el identificador del intervalo lo lleva
    // PlaybackProgressTimer, no el objeto del player.
    _startPlaybackProgressTimer(player) {
        this._progressTimer.start(player, () => this._sendProgressUpdate(player, 'timeupdate'));
    }

    _stopPlaybackProgressTimer(player) {
        this._progressTimer.stop(player);
    }

    _onPlaybackStarted(player, playOptions, streamInfo, mediaSource) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        this._setCurrentPlayerInternal(player);

        const playerData = this._playerData(player);

        playerData.streamInfo = streamInfo;

        streamInfo.playbackStartTimeTicks = new Date().getTime() * 10000;

        if (mediaSource) {
            playerData.audioStreamIndex = mediaSource.DefaultAudioStreamIndex;
            playerData.subtitleStreamIndex = mediaSource.DefaultSubtitleStreamIndex;
            playerData.secondarySubtitleStreamIndex = mediaSource.DefaultSecondarySubtitleStreamIndex;
        } else {
            playerData.audioStreamIndex = null;
            playerData.subtitleStreamIndex = null;
            playerData.secondarySubtitleStreamIndex = null;
        }

        this._playNextAfterEnded = true;
        const isFirstItem = playOptions.isFirstItem;
        const fullscreen = playOptions.fullscreen;

        const state = this.getPlayerState(player, streamInfo.item, streamInfo.mediaSource);

        reportPlayback(this, state, player, true, state.NowPlayingItem.ServerId, 'reportPlaybackStart');

        state.IsFirstItem = isFirstItem;
        state.IsFullscreen = fullscreen;
        Events.trigger(player, 'playbackstart', [state]);
        Events.trigger(this, 'playbackstart', [player, state]);

        // only used internally as a safeguard to avoid reporting other events to the server before playback start
        streamInfo.started = true;

        this._startPlaybackProgressTimer(player);
    }

    _onPlaybackChanging(activePlayer, newPlayer, newItem) {
        const state = this.getPlayerState(activePlayer);

        const serverId = this.currentItem(activePlayer).ServerId;

        // User started playing something new while existing content is playing
        let promise;

        this._stopPlaybackProgressTimer(activePlayer);
        this._unbindStopped(activePlayer);

        if (activePlayer === newPlayer) {
            // If we're staying with the same player, stop it
            promise = activePlayer.stop(false);
        } else {
            // If we're switching players, tear down the current one
            promise = activePlayer.stop(true);
        }

        return promise.then(() => {
            // Clear the data since we were not listening 'stopped'
            this._playerData(activePlayer).streamInfo = null;

            this._bindStopped(activePlayer);

            if (enableLocalPlaylistManagement(activePlayer)) {
                reportPlayback(this, state, activePlayer, true, serverId, 'reportPlaybackStopped');
            }

            Events.trigger(this, 'playbackstop', [{
                player: activePlayer,
                state: state,
                nextItem: newItem,
                nextMediaType: newItem.MediaType
            }]);
        });
    }

    /**
     * Engancha el handler de parada, sin duplicarlo si ya estaba.
     *
     * `Events.off` compara por identidad de función, así que hace falta
     * recordar el handler concreto de cada player para poder quitarlo.
     */
    _bindStopped(player) {
        if (!enableLocalPlaylistManagement(player)) return;

        this._unbindStopped(player);
        const handler = (e, displayErrorCode) => this._onPlaybackStopped(player, e, displayErrorCode);
        this._stoppedHandlers.set(player, handler);
        Events.on(player, 'stopped', handler);
    }

    _unbindStopped(player) {
        const handler = this._stoppedHandlers.get(player);
        if (!handler) return;

        Events.off(player, 'stopped', handler);
        this._stoppedHandlers.delete(player);
    }

    _initLegacyVolumeMethods(player) {
        player.getVolume = function () {
            return player.volume();
        };
        player.setVolume = function (val) {
            return player.volume(val);
        };
    }

    _initMediaPlayer(player) {
        this._players.push(player);
        this._players.sort(function (a, b) {
            return (a.priority || 0) - (b.priority || 0);
        });

        if (player.isLocalPlayer !== false) {
            player.isLocalPlayer = true;
        }

        player.currentState = {};

        if (!player.getVolume || !player.setVolume) {
            this._initLegacyVolumeMethods(player);
        }

        // Los dos casos informan del mismo progreso; se diferencian en
        // quién lleva la cola. Con gestión local, el manager sigue el
        // error para reintentar; el player autogestionado avisa él mismo
        // de cada item que empieza y termina, y no engancha 'error'.
        if (enableLocalPlaylistManagement(player)) {
            Events.on(player, 'error', (e, error) => this._onPlaybackError(player, e, error));
            bindProgressEvents(player, (p, name, reportPlaylist) => this._sendProgressUpdate(p, name, reportPlaylist));
        } else if (player.isLocalPlayer) {
            Events.on(player, 'itemstarted', (e, item, mediaSource) => this._onPlaybackStartedFromSelfManagingPlayer(player, e, item, mediaSource));
            Events.on(player, 'itemstopped', (e, playerStopInfo) => this._onPlaybackStoppedFromSelfManagingPlayer(player, e, playerStopInfo));
            bindProgressEvents(player, (p, name, reportPlaylist) => this._sendProgressUpdate(p, name, reportPlaylist));
        }

        if (player.isLocalPlayer) {
            bindToFullscreenChange(player);
        }
        this._bindStopped(player);
    }

    _sendProgressUpdate(player, progressEventName, reportPlaylist) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        const state = this.getPlayerState(player);

        if (state.NowPlayingItem) {
            const serverId = state.NowPlayingItem.ServerId;

            const streamInfo = this._playerData(player).streamInfo;

            if (streamInfo?.started && !streamInfo.ended) {
                reportPlayback(this, state, player, reportPlaylist, serverId, 'reportPlaybackProgress', progressEventName);
            }

            if (streamInfo?.liveStreamId
                && (new Date().getTime() - (streamInfo.lastMediaInfoQuery || 0) >= 600000)
            ) {
                this._getLiveStreamMediaInfo(player, streamInfo, this.currentMediaSource(player), streamInfo.liveStreamId, serverId);
            }
        }
    }

    _getLiveStreamMediaInfo(player, streamInfo, mediaSource, liveStreamId, serverId) {
        console.debug('getLiveStreamMediaInfo');

        streamInfo.lastMediaInfoQuery = new Date().getTime();

        ServerConnections.getApiClient(serverId).getLiveStreamMediaInfo(liveStreamId).then(function (info) {
            mediaSource.MediaStreams = info.MediaStreams;
            Events.trigger(player, 'mediastreamschange');
        }, function () {
            // Swallow errors
        });
    }

    currentItem(player) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        if (player.currentItem) {
            return player.currentItem();
        }

        const data = this._playerData(player);
        return data.streamInfo ? data.streamInfo.item : null;
    }

    currentMediaSource(player) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        if (player.currentMediaSource) {
            return player.currentMediaSource();
        }

        const data = this._playerData(player);
        return data.streamInfo ? data.streamInfo.mediaSource : null;
    }

    playMethod(player) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        if (player.playMethod) {
            return player.playMethod();
        }

        const data = this._playerData(player);
        return data.streamInfo ? data.streamInfo.playMethod : null;
    }

    playSessionId(player) {
        if (!player) {
            throw new Error('player cannot be null');
        }

        if (player.playSessionId) {
            return player.playSessionId();
        }

        const data = this._playerData(player);
        return data.streamInfo ? data.streamInfo.playSessionId : null;
    }

    isPlayingMediaType(mediaType, player) {
        player = player || this._currentPlayer;

        if (player?.isPlaying) {
            return player.isPlaying(mediaType);
        }

        if (this.isPlaying(player)) {
            const playerData = this._playerData(player);

            return playerData.streamInfo.mediaType === mediaType;
        }

        return false;
    }

    getAudioStreamIndex(player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.getAudioStreamIndex();
        }

        return this._playerData(player).audioStreamIndex;
    }

    enableAutomaticBitrateDetection(player) {
        player = player || this._currentPlayer;
        if (player?.enableAutomaticBitrateDetection) {
            return player.enableAutomaticBitrateDetection();
        }

        const playerData = this._playerData(player);
        const mediaType = playerData.streamInfo ? playerData.streamInfo.mediaType : null;
        const currentItem = this.currentItem(player);

        const apiClient = currentItem ? ServerConnections.getApiClient(currentItem.ServerId) : ServerConnections.currentApiClient();
        const endpointInfo = apiClient.getSavedEndpointInfo() || {};

        return appSettings.enableAutomaticBitrateDetection(endpointInfo.IsInNetwork, mediaType);
    }

    getSubtitleStreamIndex(player) {
        player = player || this._currentPlayer;

        if (player && !enableLocalPlaylistManagement(player)) {
            return player.getSubtitleStreamIndex();
        }

        if (!player) {
            throw new Error('player cannot be null');
        }

        return this._playerData(player).subtitleStreamIndex;
    }

    getSecondarySubtitleStreamIndex(player) {
        player = player || this._currentPlayer;

        if (!player) {
            throw new Error('player cannot be null');
        }

        try {
            if (!enableLocalPlaylistManagement(player)) {
                return player.getSecondarySubtitleStreamIndex();
            }
        } catch (e) {
            console.error('[playbackmanager] Failed to get secondary stream index:', e);
        }

        return this._playerData(player).secondarySubtitleStreamIndex;
    }

    playbackStartTime(player = this._currentPlayer) {
        if (player && !enableLocalPlaylistManagement(player) && !player.isLocalPlayer) {
            return player.playbackStartTime();
        }

        const streamInfo = this._playerData(player).streamInfo;
        return streamInfo ? streamInfo.playbackStartTimeTicks : null;
    }

    /**
     * Estado que el manager lleva de este player (stream en curso, pistas
     * elegidas, bitrate). Atajo a PlayerStateManager: se usa en 40 sitios.
     */
    _playerData(player) {
        return this._playerStateManager.get(player);
    }

    getPlayerInfo() {
        const player = this._currentPlayer;

        if (!player) {
            return null;
        }

        const target = this._currentTargetInfo || {};

        return {
            name: player.name,
            isLocalPlayer: player.isLocalPlayer,
            id: target.id,
            deviceName: target.deviceName,
            playableMediaTypes: target.playableMediaTypes,
            supportedCommands: target.supportedCommands
        };
    }

    getTargets() {
        const promises = this._players
            .filter(displayPlayerIndividually)
            .map(player => getPlayerTargets(this, player));

        return Promise.all(promises)
            .then(responses => responses.flat().sort(sortPlayerTargets));
    }

    playerHasSecondarySubtitleSupport(player = this._currentPlayer) {
        if (!player) return false;
        return Boolean(player.supports('SecondarySubtitles'));
    }

    trackHasSecondarySubtitleSupport(track, player = this._currentPlayer) {
        if (!player || !track) return false;
        const format = (track.Codec || '').toLowerCase();
        // Currently, only non-SSA/non-ASS external subtitles are supported.
        // Showing secondary subtitles does not work with any SSA/ASS subtitle combinations because
        // of the complexity of how they are rendered and the risk of the subtitles overlapping
        return format !== 'ssa' && format !== 'ass' && getDeliveryMethod(track) === 'External';
    }

    secondarySubtitleTracks(player = this._currentPlayer) {
        const streams = this.subtitleTracks(player);
        return streams.filter((stream) => this.trackHasSecondarySubtitleSupport(stream, player));
    }

    getSubtitleStream(player, index) {
        return this.subtitleTracks(player).filter(function (s) {
            return s.Type === 'Subtitle' && s.Index === index;
        })[0];
    }

    getPlaylist(player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            if (player.getPlaylistSync) {
                return Promise.resolve(player.getPlaylistSync());
            }

            return player.getPlaylist();
        }

        return Promise.resolve(this._playQueueManager.getPlaylist());
    }

    promptToSkip(mediaSegment, player) {
        player = player || this._currentPlayer;

        if (mediaSegment && this._skipSegment) {
            Events.trigger(player, PlayerEvent.PromptSkip, [mediaSegment]);
        }
    }

    isPlaying(player) {
        player = player || this._currentPlayer;

        if (player?.isPlaying) {
            return player.isPlaying();
        }

        return player?.currentSrc() != null;
    }

    isPlayingLocally(mediaTypes, player) {
        player = player || this._currentPlayer;

        if (!player?.isLocalPlayer) {
            return false;
        }

        // Arrow: el callback necesita el `this` del método.
        return mediaTypes.filter(
            (mediaType) => this.isPlayingMediaType(mediaType, player)
        ).length > 0;
    }

    isPlayingVideo(player) {
        return this.isPlayingMediaType('Video', player);
    }

    isPlayingAudio(player) {
        return this.isPlayingMediaType('Audio', player);
    }

    getPlayers() {
        return this._players;
    }

    toggleAspectRatio(player) {
        player = player || this._currentPlayer;

        if (player) {
            const current = this.getAspectRatio(player);

            const supported = this.getSupportedAspectRatios(player);

            let index = -1;
            for (let i = 0, length = supported.length; i < length; i++) {
                if (supported[i].id === current) {
                    index = i;
                    break;
                }
            }

            index++;
            if (index >= supported.length) {
                index = 0;
            }

            this.setAspectRatio(supported[index].id, player);
        }
    }

    setAspectRatio(val, player) {
        player = player || this._currentPlayer;

        if (player?.setAspectRatio) {
            player.setAspectRatio(val);
        }
    }

    getSupportedAspectRatios(player) {
        player = player || this._currentPlayer;

        if (player?.getSupportedAspectRatios) {
            return player.getSupportedAspectRatios();
        }

        return [];
    }

    getAspectRatio(player) {
        player = player || this._currentPlayer;

        if (player?.getAspectRatio) {
            return player.getAspectRatio();
        }
    }

    increasePlaybackRate(player) {
        player = player || this._currentPlayer;
        if (player) {
            const current = this.getPlaybackRate(player);
            const supported = this.getSupportedPlaybackRates(player);

            let index = -1;
            for (let i = 0, length = supported.length; i < length; i++) {
                if (supported[i].id === current) {
                    index = i;
                    break;
                }
            }

            index = Math.min(index + 1, supported.length - 1);
            this.setPlaybackRate(supported[index].id, player);
        }
    }

    decreasePlaybackRate(player) {
        player = player || this._currentPlayer;
        if (player) {
            const current = this.getPlaybackRate(player);
            const supported = this.getSupportedPlaybackRates(player);

            let index = -1;
            for (let i = 0, length = supported.length; i < length; i++) {
                if (supported[i].id === current) {
                    index = i;
                    break;
                }
            }

            index = Math.max(index - 1, 0);
            this.setPlaybackRate(supported[index].id, player);
        }
    }

    getSupportedPlaybackRates(player) {
        player = player || this._currentPlayer;
        if (player?.getSupportedPlaybackRates) {
            return player.getSupportedPlaybackRates();
        }
        return [];
    }

    setBrightness(val, player) {
        player = player || this._currentPlayer;

        if (player) {
            player.setBrightness(val);
        }
    }

    getBrightness(player) {
        player = player || this._currentPlayer;

        if (player) {
            return player.getBrightness();
        }
    }

    setVolume(val, player) {
        player = player || this._currentPlayer;

        if (player && !supportsPhysicalVolumeControl(player)) {
            player.setVolume(val);
        }
    }

    getVolume(player) {
        player = player || this._currentPlayer;

        if (player && !supportsPhysicalVolumeControl(player)) {
            return player.getVolume();
        }

        return 1;
    }

    volumeUp(player) {
        player = player || this._currentPlayer;

        if (player && !supportsPhysicalVolumeControl(player)) {
            player.volumeUp();
        }
    }

    volumeDown(player) {
        player = player || this._currentPlayer;

        if (player && !supportsPhysicalVolumeControl(player)) {
            player.volumeDown();
        }
    }

    changeAudioStream(player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.changeAudioStream();
        }

        if (!player) {
            return;
        }

        const currentMediaSource = this.currentMediaSource(player);
        const mediaStreams = [];
        for (let i = 0, length = currentMediaSource.MediaStreams.length; i < length; i++) {
            if (currentMediaSource.MediaStreams[i].Type === 'Audio') {
                mediaStreams.push(currentMediaSource.MediaStreams[i]);
            }
        }

        // Nothing to change
        if (mediaStreams.length <= 1) {
            return;
        }

        const currentStreamIndex = this.getAudioStreamIndex(player);
        let indexInList = -1;
        for (let i = 0, length = mediaStreams.length; i < length; i++) {
            if (mediaStreams[i].Index === currentStreamIndex) {
                indexInList = i;
                break;
            }
        }

        let nextIndex = indexInList + 1;
        if (nextIndex >= mediaStreams.length) {
            nextIndex = 0;
        }

        nextIndex = nextIndex === -1 ? -1 : mediaStreams[nextIndex].Index;

        this.setAudioStreamIndex(nextIndex, player);
    }

    changeSubtitleStream(player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.changeSubtitleStream();
        }

        if (!player) {
            return;
        }

        const currentMediaSource = this.currentMediaSource(player);
        const mediaStreams = [];
        for (let i = 0, length = currentMediaSource.MediaStreams.length; i < length; i++) {
            if (currentMediaSource.MediaStreams[i].Type === 'Subtitle') {
                mediaStreams.push(currentMediaSource.MediaStreams[i]);
            }
        }

        // No known streams, nothing to change
        if (!mediaStreams.length) {
            return;
        }

        const currentStreamIndex = this.getSubtitleStreamIndex(player);
        let indexInList = -1;
        for (let i = 0, length = mediaStreams.length; i < length; i++) {
            if (mediaStreams[i].Index === currentStreamIndex) {
                indexInList = i;
                break;
            }
        }

        let nextIndex = indexInList + 1;
        if (nextIndex >= mediaStreams.length) {
            nextIndex = -1;
        }

        nextIndex = nextIndex === -1 ? -1 : mediaStreams[nextIndex].Index;

        this.setSubtitleStreamIndex(nextIndex, player);
    }

    isFullscreen(player) {
        player = player || this._currentPlayer;
        if (!player.isLocalPlayer || player.isFullscreen) {
            return player.isFullscreen();
        }

        if (!Screenfull.isEnabled) {
            // iOS Safari
            return document.webkitIsFullScreen;
        }

        return Screenfull.isFullscreen;
    }

    toggleFullscreen(player) {
        player = player || this._currentPlayer;
        if (!player.isLocalPlayer || player.toggleFullscreen) {
            return player.toggleFullscreen();
        }

        if (Screenfull.isEnabled) {
            Screenfull.toggle();
        } else if (document.webkitIsFullScreen && document.webkitCancelFullscreen) {
            // iOS Safari
            document.webkitCancelFullscreen();
        } else {
            const elem = document.querySelector('video');
            if (elem?.webkitEnterFullscreen) {
                elem.webkitEnterFullscreen();
            }
        }
    }

    togglePictureInPicture(player) {
        player = player || this._currentPlayer;
        return player.togglePictureInPicture();
    }

    toggleAirPlay(player) {
        player = player || this._currentPlayer;
        return player.toggleAirPlay();
    }

    supportSubtitleOffset(player) {
        player = player || this._currentPlayer;
        return player && 'setSubtitleOffset' in player;
    }

    enableShowingSubtitleOffset(player) {
        player = player || this._currentPlayer;
        player.enableShowingSubtitleOffset();
    }

    disableShowingSubtitleOffset(player) {
        player = player || this._currentPlayer;
        if (player.disableShowingSubtitleOffset) {
            player.disableShowingSubtitleOffset();
        }
    }

    isShowingSubtitleOffsetEnabled(player) {
        player = player || this._currentPlayer;
        return player.isShowingSubtitleOffsetEnabled();
    }

    isSubtitleStreamExternal(index, player) {
        const stream = this.getSubtitleStream(player, index);
        return stream ? getDeliveryMethod(stream) === 'External' : false;
    }

    setSubtitleOffset(value, player) {
        player = player || this._currentPlayer;
        if (player.setSubtitleOffset) {
            player.setSubtitleOffset(value);
        }
    }

    getPlayerSubtitleOffset(player) {
        player = player || this._currentPlayer;
        if (player.getSubtitleOffset) {
            return player.getSubtitleOffset();
        }
    }

    canHandleOffsetOnCurrentSubtitle(player) {
        const index = this.getSubtitleStreamIndex(player);
        return index !== -1 && this.isSubtitleStreamExternal(index, player);
    }

    duration(player) {
        player = player || this._currentPlayer;

        if (player && !enableLocalPlaylistManagement(player) && !player.isLocalPlayer) {
            return player.duration();
        }

        if (!player) {
            throw new Error('player cannot be null');
        }

        const mediaSource = this.currentMediaSource(player);

        if (mediaSource?.RunTimeTicks) {
            return mediaSource.RunTimeTicks;
        }

        let playerDuration = player.duration();

        if (playerDuration) {
            playerDuration *= 10000;
        }

        return playerDuration;
    }

    getItemFromPlaylistItemId(playlistItemId) {
        let item;
        let itemIndex;
        const playlist = this._playQueueManager.getPlaylist();

        for (let i = 0, length = playlist.length; i < length; i++) {
            if (playlist[i].PlaylistItemId === playlistItemId) {
                item = playlist[i];
                itemIndex = i;
                break;
            }
        }

        return {
            Item: item,
            Index: itemIndex
        };
    }

    removeFromPlaylist(playlistItemIds, player) {
        if (!playlistItemIds) {
            throw new Error('Invalid playlistItemIds');
        }

        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.removeFromPlaylist(playlistItemIds);
        }

        const removeResult = this._playQueueManager.removeFromPlaylist(playlistItemIds);

        if (removeResult.result === 'empty') {
            return this.stop(player);
        }

        const isCurrentIndex = removeResult.isCurrentIndex;

        Events.trigger(player, 'playlistitemremove', [
            {
                playlistItemIds: playlistItemIds
            }
        ]);

        if (isCurrentIndex) {
            return this.setCurrentPlaylistItem(this._playQueueManager.getPlaylist()[0].PlaylistItemId, player);
        }

        return Promise.resolve();
    }

    movePlaylistItem(playlistItemId, newIndex, player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.movePlaylistItem(playlistItemId, newIndex);
        }

        const moveResult = this._playQueueManager.movePlaylistItem(playlistItemId, newIndex);

        if (moveResult.result === 'noop') {
            return;
        }

        Events.trigger(player, 'playlistitemmove', [
            {
                playlistItemId: moveResult.playlistItemId,
                newIndex: moveResult.newIndex
            }
        ]);
    }

    getCurrentPlaylistIndex(player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.getCurrentPlaylistIndex();
        }

        return this._playQueueManager.getCurrentPlaylistIndex();
    }

    getCurrentPlaylistItemId(player) {
        player = player || this._currentPlayer;
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.getCurrentPlaylistItemId();
        }

        return this._playQueueManager.getCurrentPlaylistItemId();
    }

    channelUp(player) {
        player = player || this._currentPlayer;
        return this.nextTrack(player);
    }

    channelDown(player) {
        player = player || this._currentPlayer;
        return this.previousTrack(player);
    }

    getCurrentPlayer() {
        return this._currentPlayer;
    }

    currentTime(player = this._currentPlayer) {
        if (player && !enableLocalPlaylistManagement(player) && !player.isLocalPlayer) {
            return player.currentTime();
        }

        return this.getCurrentTicks(player) / 10000;
    }

    getNextItem() {
        return this._playQueueManager.getNextItemInfo();
    }

    nextItem(player = this._currentPlayer) {
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.nextItem();
        }

        const nextItem = this._playQueueManager.getNextItemInfo();

        if (!nextItem?.item) {
            return Promise.reject();
        }

        const apiClient = ServerConnections.getApiClient(nextItem.item.ServerId);
        return apiClient.getItem(apiClient.getCurrentUserId(), nextItem.item.Id);
    }

    canQueue(item) {
        if (item.Type === 'MusicAlbum' || item.Type === 'MusicArtist' || item.Type === 'MusicGenre') {
            return this.canQueueMediaType('Audio');
        }
        return this.canQueueMediaType(item.MediaType);
    }

    canQueueMediaType(mediaType) {
        if (this._currentPlayer) {
            return this._currentPlayer.canPlayMediaType(mediaType);
        }

        return false;
    }

    isMuted(player = this._currentPlayer) {
        if (player) {
            return player.isMuted();
        }

        return false;
    }

    setMute(mute, player = this._currentPlayer) {
        if (player) {
            player.setMute(mute);
        }
    }

    toggleMute(mute, player = this._currentPlayer) {
        if (player) {
            if (player.toggleMute) {
                player.toggleMute();
            } else {
                player.setMute(!player.isMuted());
            }
        }
    }

    toggleDisplayMirroring() {
        this.enableDisplayMirroring(!this.enableDisplayMirroring());
    }

    enableDisplayMirroring(enabled) {
        if (enabled != null) {
            const val = enabled ? '1' : '0';
            appSettings.set('displaymirror', val);
            return;
        }

        return (appSettings.get('displaymirror') || '') !== '0';
    }

    nextChapter(player = this._currentPlayer) {
        const item = this.currentItem(player);

        const ticks = this.getCurrentTicks(player);

        const nextChapter = (item.Chapters || []).filter(function (i) {
            return i.StartPositionTicks > ticks;
        })[0];

        if (nextChapter) {
            this.seek(nextChapter.StartPositionTicks, player);
        } else {
            this.nextTrack(player);
        }
    }

    previousChapter(player = this._currentPlayer) {
        const item = this.currentItem(player);

        let ticks = this.getCurrentTicks(player);

        // Go back 10 seconds
        ticks -= 100000000;

        // If there's no previous track, then at least rewind to beginning
        if (this.getCurrentPlaylistIndex(player) === 0) {
            ticks = Math.max(ticks, 0);
        }

        const previousChapters = (item.Chapters || []).filter(function (i) {
            return i.StartPositionTicks <= ticks;
        });

        if (previousChapters.length) {
            this.seek(previousChapters[previousChapters.length - 1].StartPositionTicks, player);
        } else {
            this.previousTrack(player);
        }
    }

    fastForward(player = this._currentPlayer) {
        if (player.fastForward != null) {
            player.fastForward(userSettings.skipForwardLength());
            return;
        }

        // Go back 15 seconds
        const offsetTicks = userSettings.skipForwardLength() * 10000;

        this.seekRelative(offsetTicks, player);
    }

    rewind(player = this._currentPlayer) {
        if (player.rewind != null) {
            player.rewind(userSettings.skipBackLength());
            return;
        }

        // Go back 15 seconds
        const offsetTicks = 0 - (userSettings.skipBackLength() * 10000);

        this.seekRelative(offsetTicks, player);
    }

    seekFrames(frames = 1, player = this._currentPlayer) {
        // Only allow seeking by frames when paused
        if (!player.paused()) return;

        const source = this.currentMediaSource(player);
        const videoStream = source?.MediaStreams?.find(s => s.Type === MediaType.Video);
        // It only makes sense to seek video streams by frames
        if (videoStream) {
            const fps = videoStream.ReferenceFrameRate || 24;
            this.seekRelative(frames / fps * TICKS_PER_SECOND, player);
        }
    }

    seekPercent(percent, player = this._currentPlayer) {
        let ticks = this.duration(player) || 0;

        percent /= 100;
        ticks *= percent;
        this.seek(parseInt(ticks, 10), player);
    }

    seekMs(ms, player = this._currentPlayer) {
        const ticks = ms * 10000;
        this.seek(ticks, player);
    }

    async playTrailers(item) {
        const player = this._currentPlayer;

        if (player?.playTrailers) {
            return player.playTrailers(item);
        }

        const apiClient = ServerConnections.getApiClient(item.ServerId);

        let items;

        if (item.LocalTrailerCount) {
            items = await apiClient.getLocalTrailers(apiClient.getCurrentUserId(), item.Id);
        }

        if (!items?.length) {
            items = (item.RemoteTrailers || []).map((t) => {
                return {
                    Name: t.Name || (item.Name + ' Trailer'),
                    Url: t.Url,
                    MediaType: 'Video',
                    Type: 'Trailer',
                    ServerId: apiClient.serverId()
                };
            });
        }

        if (items.length) {
            return this.play({
                items
            });
        }

        return Promise.reject();
    }

    getSubtitleUrl(textStream, serverId) {
        const apiClient = ServerConnections.getApiClient(serverId);

        return !textStream.IsExternalUrl ? apiClient.getUrl(textStream.DeliveryUrl) : textStream.DeliveryUrl;
    }

    stop(player) {
        player = player || this._currentPlayer;
        if (player) {
            if (enableLocalPlaylistManagement(player)) {
                this._playNextAfterEnded = false;
            }

            // Los dos parámetros son del contrato de los players
            // (destroyPlayer, reportEnded). Quitarlos exige cambiar a la vez
            // todas las implementaciones, incluidas las de los plugins.
            return player.stop(true, true);
        }

        return Promise.resolve();
    }

    getBufferedRanges(player = this._currentPlayer) {
        if (player?.getBufferedRanges) {
            return player.getBufferedRanges();
        }

        return [];
    }

    playPause(player = this._currentPlayer) {
        if (player) {
            if (player.playPause) {
                return player.playPause();
            }

            if (player.paused()) {
                return this.unpause(player);
            } else {
                return this.pause(player);
            }
        }
    }

    paused(player = this._currentPlayer) {
        if (player) {
            return player.paused();
        }
    }

    pause(player = this._currentPlayer) {
        if (player) {
            player.pause();
        }
    }

    unpause(player = this._currentPlayer) {
        if (player) {
            player.unpause();
        }
    }

    setPlaybackRate(value, player = this._currentPlayer) {
        if (player?.setPlaybackRate) {
            player.setPlaybackRate(value);

            // Save the new playback rate in the browser session, to restore when playing a new video.
            sessionStorage.setItem('playbackRateSpeed', value);
        }
    }

    getPlaybackRate(player = this._currentPlayer) {
        if (player?.getPlaybackRate) {
            return player.getPlaybackRate();
        }

        return null;
    }

    instantMix(item, player = this._currentPlayer) {
        if (player?.instantMix) {
            return player.instantMix(item);
        }

        const apiClient = ServerConnections.getApiClient(item.ServerId);

        const options = {
            UserId: apiClient.getCurrentUserId(),
            Limit: 200
        };

        const instance = this;

        apiClient.getInstantMixFromItem(item.Id, options).then(function (result) {
            instance.play({
                items: result.Items
            });
        });
    }

    shuffle(shuffleItem, player = this._currentPlayer) {
        if (player?.shuffle) {
            return player.shuffle(shuffleItem);
        }

        return this.play({ items: [shuffleItem], shuffle: true });
    }

    audioTracks(player = this._currentPlayer) {
        if (player.audioTracks) {
            const result = player.audioTracks();
            if (result) {
                return result.sort(itemHelper.sortTracks);
            }
        }

        const mediaSource = this.currentMediaSource(player);

        const mediaStreams = mediaSource?.MediaStreams || [];
        return mediaStreams.filter(function (s) {
            return s.Type === 'Audio';
        }).sort(itemHelper.sortTracks);
    }

    subtitleTracks(player = this._currentPlayer) {
        if (player.subtitleTracks) {
            const result = player.subtitleTracks();
            if (result) {
                return result.sort(itemHelper.sortTracks);
            }
        }

        const mediaSource = this.currentMediaSource(player);

        const mediaStreams = mediaSource?.MediaStreams || [];
        return mediaStreams.filter(function (s) {
            return s.Type === 'Subtitle';
        }).sort(itemHelper.sortTracks);
    }

    getSupportedCommands(player) {
        player = player || this._currentPlayer || { isLocalPlayer: true };

        if (player.isLocalPlayer) {
            const list = [
                'GoHome',
                'GoToSettings',
                'VolumeUp',
                'VolumeDown',
                'Mute',
                'Unmute',
                'ToggleMute',
                'SetVolume',
                'SetAudioStreamIndex',
                'SetSubtitleStreamIndex',
                'SetMaxStreamingBitrate',
                'DisplayContent',
                'GoToSearch',
                'DisplayMessage',
                'SetRepeatMode',
                'SetShuffleQueue',
                'PlayMediaSource',
                'PlayTrailers'
            ];

            if (appHost.supports(AppFeature.Fullscreen)) {
                list.push('ToggleFullscreen');
            }

            if (player.supports) {
                if (player.supports('PictureInPicture')) {
                    list.push('PictureInPicture');
                }
                if (player.supports('AirPlay')) {
                    list.push('AirPlay');
                }
                if (player.supports('SetBrightness')) {
                    list.push('SetBrightness');
                }
                if (player.supports('SetAspectRatio')) {
                    list.push('SetAspectRatio');
                }
                if (player.supports('PlaybackRate')) {
                    list.push('PlaybackRate');
                }
            }

            return list;
        }

        const info = this.getPlayerInfo();
        return info ? info.supportedCommands : [];
    }

    setRepeatMode(value, player = this._currentPlayer) {
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.setRepeatMode(value);
        }

        this._playQueueManager.setRepeatMode(value);
        Events.trigger(player, 'repeatmodechange');
    }

    getRepeatMode(player = this._currentPlayer) {
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.getRepeatMode();
        }

        return this._playQueueManager.getRepeatMode();
    }

    setQueueShuffleMode(value, player = this._currentPlayer) {
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.setQueueShuffleMode(value);
        }

        this._playQueueManager.setShuffleMode(value);
        Events.trigger(player, 'shufflequeuemodechange');
    }

    getQueueShuffleMode(player = this._currentPlayer) {
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.getQueueShuffleMode();
        }

        return this._playQueueManager.getShuffleMode();
    }

    toggleQueueShuffleMode(player = this._currentPlayer) {
        let currentvalue;
        if (player && !enableLocalPlaylistManagement(player)) {
            currentvalue = player.getQueueShuffleMode();
            switch (currentvalue) {
                case 'Shuffle':
                    player.setQueueShuffleMode('Sorted');
                    break;
                case 'Sorted':
                    player.setQueueShuffleMode('Shuffle');
                    break;
                default:
                    throw new TypeError('current value for shufflequeue is invalid');
            }
        } else {
            this._playQueueManager.toggleShuffleMode();
        }
        Events.trigger(player, 'shufflequeuemodechange');
    }

    clearQueue(clearCurrentItem = false, player = this._currentPlayer) {
        if (player && !enableLocalPlaylistManagement(player)) {
            return player.clearQueue(clearCurrentItem);
        }

        this._playQueueManager.clearPlaylist(clearCurrentItem);
        Events.trigger(player, 'playlistitemremove');
    }

    trySetActiveDeviceName(name) {
        name = normalizeName(name);

        const instance = this;
        instance.getTargets().then(function (result) {
            const target = result.filter(function (p) {
                return normalizeName(p.name) === name;
            })[0];

            if (target) {
                instance.trySetActivePlayer(target.playerName, target);
            }
        });
    }

    displayContent(options, player = this._currentPlayer) {
        if (player?.displayContent) {
            player.displayContent(options);
        }
    }

    beginPlayerUpdates(player) {
        if (player.beginPlayerUpdates) {
            player.beginPlayerUpdates();
        }
    }

    endPlayerUpdates(player) {
        if (player.endPlayerUpdates) {
            player.endPlayerUpdates();
        }
    }

    setDefaultPlayerActive() {
        this.setActivePlayer('localplayer');
    }

    removeActivePlayer(name) {
        const playerInfo = this.getPlayerInfo();
        if (playerInfo?.name === name) {
            this.setDefaultPlayerActive();
        }
    }

    removeActiveTarget(id) {
        const playerInfo = this.getPlayerInfo();
        if (playerInfo?.id === id) {
            this.setDefaultPlayerActive();
        }
    }

    sendCommand(cmd, player) {
        console.debug('MediaController received command: ' + cmd.Name);
        switch (cmd.Name) {
            case 'SetRepeatMode':
                this.setRepeatMode(cmd.Arguments.RepeatMode, player);
                break;
            case 'SetShuffleQueue':
                this.setQueueShuffleMode(cmd.Arguments.ShuffleMode, player);
                break;
            case 'VolumeUp':
                this.volumeUp(player);
                break;
            case 'VolumeDown':
                this.volumeDown(player);
                break;
            case 'Mute':
                this.setMute(true, player);
                break;
            case 'Unmute':
                this.setMute(false, player);
                break;
            case 'ToggleMute':
                this.toggleMute(player);
                break;
            case 'SetVolume':
                this.setVolume(cmd.Arguments.Volume, player);
                break;
            case 'SetAspectRatio':
                this.setAspectRatio(cmd.Arguments.AspectRatio, player);
                break;
            case 'PlaybackRate':
                this.setPlaybackRate(cmd.Arguments.PlaybackRate, player);
                break;
            case 'SetBrightness':
                this.setBrightness(cmd.Arguments.Brightness, player);
                break;
            case 'SetAudioStreamIndex':
                this.setAudioStreamIndex(parseInt(cmd.Arguments.Index, 10), player);
                break;
            case 'SetSubtitleStreamIndex':
                this.setSubtitleStreamIndex(parseInt(cmd.Arguments.Index, 10), player);
                break;
            case 'SetMaxStreamingBitrate':
                this.setMaxStreamingBitrate(parseInt(cmd.Arguments.Bitrate, 10), player);
                break;
            case 'ToggleFullscreen':
                this.toggleFullscreen(player);
                break;
            default:
                if (player.sendCommand) {
                    player.sendCommand(cmd);
                }
                break;
        }
    }
}

export const playbackManager = new PlaybackManager();
bindMediaSegmentManager(playbackManager);
bindMediaSessionSubscriber(playbackManager);

function onPageClosing() {
    try {
        playbackManager.onAppClose();
    } catch (err) {
        console.error('error in onAppClose: ' + err);
    }
}
window.addEventListener('beforeunload', onPageClosing);
// beforeunload no dispara siempre en Chromium moderno (tab close agresivo,
// móvil, bfcache) — pagehide es el evento fiable equivalente.
window.addEventListener('pagehide', onPageClosing);
