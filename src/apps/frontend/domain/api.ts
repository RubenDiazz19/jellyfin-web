// Fachada de la API para las vistas sin ViewModel propio: Ajustes, el editor
// de metadatos, el menú de «más opciones» y los diálogos de listas. Son
// herramientas de gestión —una pantalla, una acción, sin estado que compartir
// con nadie— y llegan al Model por aquí para respetar la regla «presentation
// no importa de data/».
//
// La lista está enumerada a mano y no es un `export *`: así se ve de un
// vistazo a qué tiene acceso la capa de presentación, y ampliar la superficie
// de `data/api` no se la amplía a ella de rebote. Todo lo que sirva a una
// pantalla con estado propio va por su ViewModel, no por aquí.

// ── Ajustes: cuenta y preferencias del usuario ──────────────────────────────
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
} from '../data/api';

// ── Ajustes: servidor y reproducción ────────────────────────────────────────
export { getSystemInfo, refreshLibrary, type SystemInfo } from '../data/api';
export { getMaxStreamingBitrate, setMaxStreamingBitrate } from '../data/api';
// Idiomas recordados por película/serie: mandan sobre la preferencia del
// usuario, y desde Ajustes se pueden borrar todos de golpe.
export { countTitleLanguagePrefs, clearAllTitleLanguagePrefs } from '../data/api';

// ── Acciones sobre un item (menú de «más opciones») ─────────────────────────
export {
    markPlayed,
    refreshItemMetadata,
    deleteItem,
    downloadUrl,
    nativeItemUrl
} from '../data/api';

// ── Editor de metadatos, imágenes y subtítulos ──────────────────────────────
export {
    getItemRaw,
    updateItemMetadata,
    remoteSearch,
    applyRemoteSearchResult,
    setItemTags,
    type RemoteSearchResult
} from '../data/api';
export {
    setImageByUrl,
    deleteImage,
    uploadImageFile,
    getRemoteImages,
    imageUrl,
    type JFRemoteImage
} from '../data/api';
export { searchSubtitles, downloadSubtitle, type RemoteSubtitle } from '../data/api';

// ── Listas de reproducción y colecciones ────────────────────────────────────
// El estado de las listas lo lleva el store (domain/stores); esto es lo que
// hace falta para crearlas y para pintar su contenido.
export {
    getPlaylists,
    addToPlaylist,
    createPlaylist,
    getPlaylistItems,
    getCollections,
    getCollectionItems,
    addToCollection,
    createCollection,
    type ListEntry,
    type PlaylistItem
} from '../data/api';
