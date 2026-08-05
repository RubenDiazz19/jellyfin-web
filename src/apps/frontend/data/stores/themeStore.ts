// Preferencias del tema M3 (solo mobile/tablet) persistidas en localStorage.
// El shape es plano y serializable: se sube tal cual al server via
// DisplayPreferences.CustomPrefs (data/api/theme.ts).

export type ThemeMode = 'dark' | 'light' | 'system';

/**
 * De dónde sale la seed: 'auto' la extrae del backdrop/póster que se esté
 * viendo (dynamic color), 'manual' la eligió el usuario en Ajustes y entonces
 * el dynamic color no la pisa.
 */
export type SeedSource = 'auto' | 'manual';

export type ThemePrefs = {
    mode: ThemeMode;
    /** Seed #rrggbb del que se derivan las paletas; null = seed por defecto. */
    seed: string | null;
    seedSource: SeedSource;
};

const KEY = 'jfp-theme';

// Dark por defecto: es el look actual de la app. 'system'/'light' son
// opt-in hasta que las páginas consuman los tokens (fases 4/6).
export const THEME_DEFAULTS: ThemePrefs = { mode: 'dark', seed: null, seedSource: 'auto' };

export function isThemeMode(v: unknown): v is ThemeMode {
    return v === 'dark' || v === 'light' || v === 'system';
}

export function isSeedSource(v: unknown): v is SeedSource {
    return v === 'auto' || v === 'manual';
}

export function isSeedColor(v: unknown): v is string {
    return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

export const THEME_STORE = {
    load(): ThemePrefs {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>;
            return {
                mode: isThemeMode(raw.mode) ? raw.mode : THEME_DEFAULTS.mode,
                seed: isSeedColor(raw.seed) ? raw.seed.toLowerCase() : THEME_DEFAULTS.seed,
                seedSource: isSeedSource(raw.seedSource) ? raw.seedSource : THEME_DEFAULTS.seedSource
            };
        } catch {
            return { ...THEME_DEFAULTS };
        }
    },
    save(prefs: ThemePrefs) {
        localStorage.setItem(KEY, JSON.stringify(prefs));
    }
};
