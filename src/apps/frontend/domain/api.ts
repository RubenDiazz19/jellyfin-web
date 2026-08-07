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
    // Cambiar la foto de perfil tiene que verse también en el avatar de la
    // barra superior, que la lee de la sesión.
    setSessionUser,
    type CurrentUser,
    type UserConfig,
    type SubtitleMode,
    type UserView,
    type UserListEntry
} from '../data/api';
// Idioma de la interfaz y formato de fecha. No están en la configuración del
// usuario sino en DisplayPreferences, que es de donde los lee globalize.
export {
    getAvailableLocales,
    getLocalePrefs,
    setLocalePrefs,
    type LocalePrefs
} from '../data/api';

// ── Ajustes: servidor y reproducción ────────────────────────────────────────
export { getSystemInfo, refreshLibrary, type SystemInfo } from '../data/api';
// Lo que el servidor está procesando ahora mismo. El estado lo lleva
// TasksViewModel; esto es solo la forma con la que la vista lo pinta.
export type { BackgroundTask } from '../data/api';
export { getMaxStreamingBitrate, setMaxStreamingBitrate } from '../data/api';
// Ajustes del reproductor de este dispositivo: cuánto salta cada botón y si
// el reloj cuenta hacia atrás. Los lee el reproductor por su ViewModel.
export {
    getSkipLengths,
    setSkipLengths,
    getShowRemainingTime,
    setShowRemainingTime,
    type SkipLengths
} from '../data/api';
// Idiomas recordados por película/serie: mandan sobre la preferencia del
// usuario, y desde Ajustes se pueden borrar todos de golpe.
export { countTitleLanguagePrefs, clearAllTitleLanguagePrefs } from '../data/api';

// ── Reproductor: adelantar el arranque desde la ficha ───────────────────────
// No abre nada ni devuelve nada: negocia con el servidor lo que el reproductor
// necesitará dentro de un momento, para que al montarse ya lo tenga. Ver
// `playbackPrewarm`.
export { prewarmPlayback } from '../data/api';

// ── Acciones sobre un item (menú de «más opciones» y corazón) ───────────────
export {
    markPlayed,
    toggleFavorite,
    favoriteServerId,
    refreshItemMetadata,
    deleteItem,
    downloadUrl,
    nativeItemUrl,
    // Qué se vuelve a pedir al servidor en un rescan: lo elige el usuario en
    // el diálogo de refresco, igual que en el Jellyfin nativo.
    type RefreshMode,
    type RefreshOptions
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
    moveImage,
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
