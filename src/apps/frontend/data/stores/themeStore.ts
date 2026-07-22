// Preferencias del tema M3 (solo mobile/tablet) persistidas en localStorage.
// El shape es plano y serializable: se sube tal cual al server via
// DisplayPreferences.CustomPrefs (data/api/theme.ts).

export type ThemeMode = 'dark' | 'light' | 'system';

export type ThemePrefs = {
    mode: ThemeMode;
    /** Seed #rrggbb del que se derivan las paletas; null = seed por defecto. */
    seed: string | null;
};

const KEY = 'jfp-theme';

// Dark por defecto: es el look actual de la app. 'system'/'light' son
// opt-in hasta que las páginas consuman los tokens (fases 4/6).
export const THEME_DEFAULTS: ThemePrefs = { mode: 'dark', seed: null };

export function isThemeMode(v: unknown): v is ThemeMode {
    return v === 'dark' || v === 'light' || v === 'system';
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
                seed: isSeedColor(raw.seed) ? raw.seed.toLowerCase() : THEME_DEFAULTS.seed
            };
        } catch {
            return { ...THEME_DEFAULTS };
        }
    },
    save(prefs: ThemePrefs) {
        localStorage.setItem(KEY, JSON.stringify(prefs));
    }
};
