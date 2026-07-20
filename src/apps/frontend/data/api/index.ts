// Public surface of the Jellyfin API layer. The frontend imports everything
// from this barrel — the split into domain files stays internal.

export { normalizeServerUrl } from './http';
export { authenticate, type AuthResult } from './auth';
export { imageUrl, getItemBackdrops, type ImageType } from './images';
export { clearShowCache } from './cache';
export { getShows, getShow } from './shows';
export { getMovie, getMovies } from './movies';
export { getHomeCarousel } from './home';
export {
    getPlaybackDecision,
    subtitleVttUrl,
    reportPlaybackStart,
    reportPlaybackProgress,
    reportPlaybackStop,
    type PlaybackDecision,
    type MediaStreamInfo
} from './playback';
export {
    markPlayed,
    toggleFavorite,
    refreshItemMetadata,
    deleteItem,
    downloadUrl,
    nativeItemUrl
} from './items';
export {
    getItemRaw,
    updateItemMetadata,
    remoteSearch,
    applyRemoteSearchResult,
    type ItemMetadataPatch,
    type RemoteSearchResult
} from './metadata';
export {
    setImageByUrl,
    deleteImage,
    uploadImageFile,
    getRemoteImages,
    type JFRemoteImage
} from './remote-images';
export { searchSubtitles, downloadSubtitle, type RemoteSubtitle } from './subtitles';
export { getSystemInfo, refreshLibrary, dashboardUrl, type SystemInfo } from './admin';
export { getMaxStreamingBitrate, setMaxStreamingBitrate } from './playback';
export {
    getCurrentUser,
    updateUserConfig,
    changePassword,
    avatarUrl,
    uploadAvatar,
    deleteAvatar,
    getUserViews,
    getUsers,
    type CurrentUser,
    type UserConfig,
    type SubtitleMode,
    type UserView,
    type UserListEntry
} from './users';
