// Preferencias de pantalla del usuario.
//
// Jellyfin las parte en dos sitios y aquí se respeta esa división, porque es
// lo que hace que el ajuste valga también fuera de esta app:
//
//   - Idioma y formato de fecha los lleva el módulo legacy
//     `scripts/settings/userSettings`, que los guarda por usuario en este
//     navegador (el nativo tampoco los sube al servidor) y, sobre todo, es a
//     quien globalize escucha para recargar el diccionario. Escribir el valor
//     por nuestra cuenta en localStorage guardaría la preferencia pero no
//     cambiaría el idioma: nadie estaría escuchando.
//   - Episodios que faltan y ocultar lo visto en «Últimas» son del servidor
//     (UserConfiguration) y los aplica él al responder, así que van por
//     `updateUserConfig` como el resto de la configuración del usuario.
//
// El módulo legacy se carga con `import()` a propósito: arrastra el cliente de
// API entero (ServerConnections, playbackmanager…) y no puede quedar colgando
// de la cadena de imports de `data/api`, que se carga siempre.

/** Lo que se usa de `currentSettings`; el resto del módulo legacy se ignora. */
type LegacyUserSettings = {
    language: (val?: string) => string | null;
    dateTimeLocale: (val?: string) => string | null;
};

let cached: LegacyUserSettings | null = null;

async function legacySettings(): Promise<LegacyUserSettings> {
    if (!cached) {
        const mod = await import('scripts/settings/userSettings');
        cached = mod.currentSettings as unknown as LegacyUserSettings;
    }
    return cached;
}

export type LocalePrefs = {
    /** Código del idioma de la interfaz; vacío = el del navegador. */
    language: string;
    /** Locale de fechas y horas; vacío = el mismo que la interfaz. */
    dateTimeLocale: string;
};

export async function getLocalePrefs(): Promise<LocalePrefs> {
    const settings = await legacySettings();
    return {
        language: settings.language() ?? '',
        dateTimeLocale: settings.dateTimeLocale() ?? ''
    };
}

/**
 * Guarda idioma y/o formato de fecha.
 *
 * La escritura es síncrona, pero `userSettings` emite además un `change` que
 * globalize —enganchado en el arranque— aprovecha para recalcular la cultura y
 * volver a bajar el diccionario. Eso último sí es asíncrono y a nadie le da
 * tiempo a esperarlo: por eso quien cambia el idioma recarga la app, que es la
 * forma de que TODO lo pintado hable el mismo idioma y no la mitad.
 */
export async function setLocalePrefs(patch: Partial<LocalePrefs>): Promise<void> {
    const settings = await legacySettings();
    if (patch.language !== undefined) settings.language(patch.language);
    if (patch.dateTimeLocale !== undefined) settings.dateTimeLocale(patch.dateTimeLocale);
}

/** Los idiomas con traducción, tal cual los publica el diccionario. */
export async function getAvailableLocales(): Promise<string[]> {
    const mod = await import('lib/globalize/locales');
    return mod.default.map((l) => l.lang);
}
