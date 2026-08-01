// Public surface of the Jellyfin API layer. The frontend imports everything
// from this barrel — the split into domain files stays internal.

export { normalizeServerUrl } from './http';
export { authenticate, type AuthResult } from './auth';
export {
    isQuickConnectEnabled,
    startQuickConnect,
    waitForQuickConnect,
    authenticateWithQuickConnect,
    type QuickConnectRequest
} from './quickConnect';
export { imageUrl, type ImageType } from './images';
export { clearShowCache } from './cache';
export { getShows, getShow } from './shows';
export { getMovie, getMovies } from './movies';
export { getByGenre, getByPerson, getSimilar, searchCatalog, type CatalogSlice } from './discover';
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
export { getFavoriteKeys, favoriteServerId, hydrateFavorites } from './favorites';
export {
    getItemRaw,
    updateItemMetadata,
    remoteSearch,
    applyRemoteSearchResult,
    setItemTags,
    setItemsTags,
    normalizeTags,
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
// Idiomas recordados por película/serie: mandan sobre la preferencia del
// usuario, y desde Ajustes se pueden borrar todos de golpe.
export {
    countTitleLanguagePrefs,
    clearAllTitleLanguagePrefs,
    type TitleLanguagePref
} from '../preferences/languagePrefs';
export { getSystemInfo, refreshLibrary, type SystemInfo } from './admin';
export { getMaxStreamingBitrate, setMaxStreamingBitrate } from './playback';
export {
    getPlaylists,
    addToPlaylist,
    createPlaylist,
    getPlaylistItems,
    collapseSeries,
    removeFromPlaylist,
    getCollections,
    getCollectionItems,
    addToCollection,
    removeFromCollection,
    createCollection,
    type ListEntry,
    type PlaylistItem
} from './lists';
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
