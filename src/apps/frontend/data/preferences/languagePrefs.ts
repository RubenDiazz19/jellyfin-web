// Idioma preferido de audio y subtítulos POR TÍTULO (una película, o una
// serie entera). Es el escalón más específico de la cadena que resuelve el
// reproductor al abrir un item:
//
//   1. preferencia de esta película/serie  ← esto
//   2. preferencia del usuario (Ajustes → Reproducción / Subtítulos; el
//      servidor la aplica al resolver PlaybackInfo)
//   3. pista por defecto del fichero
//
// Se guarda en el navegador y separado por usuario: Jellyfin no expone un
// campo por item donde persistir esto, y escribirlo en la metadata del
// servidor lo compartiría entre todas las cuentas. El userId llega por
// parámetro (no se lee de la sesión aquí) para que este módulo siga siendo
// localStorage puro, sin arrastrar el SDK.

const KEY_PREFIX = 'jfp-lang-prefs';

export type TitleLanguagePref = {
    /** Código de idioma del audio (ISO 639-2, tal cual lo reporta Jellyfin). */
    audio?: string;
    /** Idioma de los subtítulos; `null` = apagados a propósito. */
    subtitle?: string | null;
};

type PrefStore = Record<string, TitleLanguagePref>;

function storageKey(userId: string): string | null {
    return userId ? `${KEY_PREFIX}:${userId}` : null;
}

function readStore(userId: string): PrefStore {
    const key = storageKey(userId);
    if (!key) return {};
    try {
        const raw = localStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        // Un localStorage manipulado (o de una versión anterior) no puede
        // tumbar el arranque de una reproducción.
        return parsed && typeof parsed === 'object' ? parsed as PrefStore : {};
    } catch {
        return {};
    }
}

function writeStore(userId: string, store: PrefStore): void {
    const key = storageKey(userId);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(store));
    } catch { /* cuota llena / modo privado: la preferencia no es crítica */ }
}

/** Preferencia guardada para un título, o null si nunca se ha tocado. */
export function getTitleLanguagePref(userId: string, titleId: string): TitleLanguagePref | null {
    if (!titleId) return null;
    const pref = readStore(userId)[titleId];
    if (!pref) return null;
    // Un objeto vacío equivale a "sin preferencia".
    return pref.audio === undefined && pref.subtitle === undefined ? null : pref;
}

/**
 * Fija (o actualiza) la preferencia de un título. El parche es parcial a
 * propósito: elegir audio no debe borrar el subtítulo recordado.
 */
export function setTitleLanguagePref(
    userId: string, titleId: string, patch: TitleLanguagePref
): void {
    if (!titleId) return;
    const store = readStore(userId);
    store[titleId] = { ...store[titleId], ...patch };
    writeStore(userId, store);
}

/** Cuántos títulos tienen idiomas propios guardados (para Ajustes). */
export function countTitleLanguagePrefs(userId: string): number {
    return Object.keys(readStore(userId)).length;
}

/** Borra las preferencias de TODOS los títulos de este usuario. */
export function clearAllTitleLanguagePrefs(userId: string): void {
    const key = storageKey(userId);
    if (key) localStorage.removeItem(key);
}

/** Olvida la preferencia de un título: vuelve a mandar la del usuario. */
export function clearTitleLanguagePref(userId: string, titleId: string): void {
    if (!titleId) return;
    const store = readStore(userId);
    if (!(titleId in store)) return;
    delete store[titleId];
    writeStore(userId, store);
}
