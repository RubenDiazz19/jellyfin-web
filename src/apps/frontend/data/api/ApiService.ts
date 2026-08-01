// Punto único de acceso al Model para los ViewModels. Cada ViewModel recibe
// un ApiService por constructor, lo que permite:
//   - testearlos con mocks: `new HomeViewModel(mockApiService)`
//   - cambiar la implementación sin tocar ningún ViewModel
//   - un solo import desde data/ en la capa domain
//
// Los grupos (session, catalog, playback…) son objetos de funciones ya
// existentes en data/, no clases: la agrupación da estructura y tipado sin
// duplicar lógica.

import {
    loadSession,
    restoreSession,
    clearSession,
    setSessionDisplayName,
    notifySessionChanged,
    wireServerConnectionsEvents,
    SESSION_EVENT,
    type Session
} from '../session/session';
import { authenticate } from './auth';
import {
    isQuickConnectEnabled,
    startQuickConnect,
    waitForQuickConnect,
    authenticateWithQuickConnect
} from './quickConnect';
import { normalizeServerUrl } from './http';
import { clearShowCache } from './cache';
import { getShows, getShow } from './shows';
import { getMovie, getMovies } from './movies';
import { getByGenre, getByPerson, getSimilar, searchCatalog } from './discover';
import { getHomeCarousel } from './home';
import { imageUrl } from './images';
import {
    markPlayed,
    toggleFavorite,
    refreshItemMetadata,
    deleteItem,
    downloadUrl,
    nativeItemUrl
} from './items';
import { favoriteServerId, hydrateFavorites } from './favorites';
import {
    getPlaybackDecision,
    subtitleVttUrl,
    reportPlaybackStart,
    reportPlaybackProgress,
    reportPlaybackStop,
    getDeviceId,
    getMaxStreamingBitrate
} from './playback';
import { getNextEpisode, getPlaybackContext } from './playbackContext';
import { getMediaSegments } from './segments';
import {
    getItemRaw,
    updateItemMetadata,
    remoteSearch,
    applyRemoteSearchResult,
    setItemTags,
    setItemsTags
} from './metadata';
import {
    setImageByUrl,
    deleteImage,
    uploadImageFile,
    getRemoteImages
} from './remote-images';
import { searchSubtitles, downloadSubtitle } from './subtitles';
import { getSystemInfo, refreshLibrary } from './admin';
import {
    getCurrentUser,
    updateUserConfig,
    changePassword,
    avatarUrl,
    uploadAvatar,
    deleteAvatar,
    getUserViews,
    getUsers
} from './users';

export type { Session };

const sessionService = {
    load: loadSession,
    restore: restoreSession,
    clear: clearSession,
    setDisplayName: setSessionDisplayName,
    notifyChanged: notifySessionChanged,
    wireServerConnectionsEvents,
    changeEvent: SESSION_EVENT
};

const authService = {
    authenticate,
    normalizeServerUrl,
    isQuickConnectEnabled,
    startQuickConnect,
    waitForQuickConnect,
    authenticateWithQuickConnect
};

const catalogService = { getShows, getShow, getMovie, getMovies, getHomeCarousel, clearShowCache };

const discoverService = { getByGenre, getByPerson, getSimilar, searchCatalog };

const imageService = { imageUrl };

const itemService = {
    markPlayed,
    toggleFavorite,
    favoriteServerId,
    hydrateFavorites,
    refreshItemMetadata,
    deleteItem,
    downloadUrl,
    nativeItemUrl
};

const playbackService = {
    getPlaybackDecision,
    subtitleVttUrl,
    reportPlaybackStart,
    reportPlaybackProgress,
    reportPlaybackStop,
    getMediaSegments,
    getPlaybackContext,
    getNextEpisode,
    getDeviceId,
    getMaxStreamingBitrate
};

const metadataService = {
    getItemRaw,
    updateItemMetadata,
    remoteSearch,
    applyRemoteSearchResult,
    setItemTags,
    setItemsTags
};

const remoteImageService = {
    setImageByUrl,
    deleteImage,
    uploadImageFile,
    getRemoteImages
};

const subtitleService = { searchSubtitles, downloadSubtitle };

const adminService = { getSystemInfo, refreshLibrary };

const userService = {
    getCurrentUser,
    updateUserConfig,
    changePassword,
    avatarUrl,
    uploadAvatar,
    deleteAvatar,
    getUserViews,
    getUsers
};

export type SessionService = typeof sessionService;
export type AuthService = typeof authService;
export type CatalogService = typeof catalogService;
export type DiscoverService = typeof discoverService;
export type ImageService = typeof imageService;
export type ItemService = typeof itemService;
export type PlaybackService = typeof playbackService;
export type MetadataService = typeof metadataService;
export type RemoteImageService = typeof remoteImageService;
export type SubtitleService = typeof subtitleService;
export type AdminService = typeof adminService;
export type UserService = typeof userService;

export class ApiService {
    // eslint-disable-next-line max-params -- DI por constructor con defaults
    constructor(
        readonly session: SessionService = sessionService,
        readonly auth: AuthService = authService,
        readonly catalog: CatalogService = catalogService,
        readonly discover: DiscoverService = discoverService,
        readonly images: ImageService = imageService,
        readonly items: ItemService = itemService,
        readonly playback: PlaybackService = playbackService,
        readonly metadata: MetadataService = metadataService,
        readonly remoteImages: RemoteImageService = remoteImageService,
        readonly subtitles: SubtitleService = subtitleService,
        readonly admin: AdminService = adminService,
        readonly users: UserService = userService
    ) {}
}

// Instancia por defecto que usa la app real. Los tests construyen la suya
// con los grupos que necesiten mockeados.
export const apiService = new ApiService();
