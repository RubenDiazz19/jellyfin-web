// Constantes y umbrales centralizados para gestos táctiles (mobile / tablet).
// Evita números mágicos dispersos por componentes y permite calibrar la sensibilidad en un único punto.

/** Arrastre y descarte (BottomSheet M3, Snackbars / Toasts) */
export const DRAG_THRESHOLD = 8;
export const DISMISS_DISTANCE = 96;
export const DISMISS_VELOCITY = 0.5;

/** Carrusel / Hero Swipe */
export const SWIPE_DRAG_THRESHOLD = 48;
export const SWIPE_VERTICAL_TOLERANCE = 60;

/** Swipe atrás desde el borde izquierdo (swipeBack) */
export const SWIPE_BACK_EDGE_PX = 20;
export const SWIPE_BACK_MIN_DX = 90;
export const SWIPE_BACK_MAX_DY = 50;
export const SWIPE_BACK_MAX_MS = 500;

/** Gestos del reproductor de vídeo */
export const VIDEO_MOVE_THRESHOLD = 12;
export const VIDEO_CLOSE_BAND = 0.22;
export const VIDEO_CLOSE_DISTANCE = 110;
export const VIDEO_SEEK_RANGE_SECONDS = 120;
