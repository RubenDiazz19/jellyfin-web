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
    clearSession,
    setSessionDisplayName,
    notifySessionChanged,
    wireServerConnectionsEvents,
    SESSION_EVENT,
    type Session
} from '../session/session';
import { authenticate } from './auth';
import { normalizeServerUrl } from './http';
import { clearShowCache } from './cache';
import { getShows, getShow } from './shows';
import { getMovie, getMovies } from './movies';
import { getHomeCarousel } from './home';
import { imageUrl, getItemBackdrops } from './images';
import {
    markPlayed,
    toggleFavorite,
    refreshItemMetadata,
    deleteItem,
    downloadUrl,
    nativeItemUrl
} from './items';
import {
    getPlaybackDecision,
    subtitleVttUrl,
    reportPlaybackStart,
    reportPlaybackProgress,
    reportPlaybackStop
} from './playback';
import {
    getItemRaw,
    updateItemMetadata,
    remoteSearch,
    applyRemoteSearchResult
} from './metadata';
import {
    setImageByUrl,
    deleteImage,
    uploadImageFile,
    getRemoteImages
} from './remote-images';
import { searchSubtitles, downloadSubtitle } from './subtitles';
import { getSystemInfo, refreshLibrary, dashboardUrl } from './admin';
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
    clear: clearSession,
    setDisplayName: setSessionDisplayName,
    notifyChanged: notifySessionChanged,
    wireServerConnectionsEvents,
    changeEvent: SESSION_EVENT
};

const authService = { authenticate, normalizeServerUrl };

const catalogService = { getShows, getShow, getMovie, getMovies, getHomeCarousel, clearShowCache };

const imageService = { imageUrl, getItemBackdrops };

const itemService = {
    markPlayed,
    toggleFavorite,
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
    reportPlaybackStop
};

const metadataService = {
    getItemRaw,
    updateItemMetadata,
    remoteSearch,
    applyRemoteSearchResult
};

const remoteImageService = {
    setImageByUrl,
    deleteImage,
    uploadImageFile,
    getRemoteImages
};

const subtitleService = { searchSubtitles, downloadSubtitle };

const adminService = { getSystemInfo, refreshLibrary, dashboardUrl };

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
