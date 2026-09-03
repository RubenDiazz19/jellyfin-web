// Preferencias del tema M3 (solo mobile/tablet) persistidas en localStorage.
// El shape es plano y serializable: se sube tal cual al server via
// DisplayPreferences.CustomPrefs (data/api/theme.ts).

import { createKVStore } from './persistentStore';

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
const THEME_DEFAULTS: ThemePrefs = { mode: 'dark', seed: null, seedSource: 'auto' };

export function isThemeMode(v: unknown): v is ThemeMode {
    return v === 'dark' || v === 'light' || v === 'system';
}

function isSeedSource(v: unknown): v is SeedSource {
    return v === 'auto' || v === 'manual';
}

export function isSeedColor(v: unknown): v is string {
    return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

const store = createKVStore<ThemePrefs>({
    key: KEY,
    parse: (raw) => {
        const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
        return {
            mode: isThemeMode(obj.mode) ? obj.mode : THEME_DEFAULTS.mode,
            seed: isSeedColor(obj.seed) ? obj.seed.toLowerCase() : THEME_DEFAULTS.seed,
            seedSource: isSeedSource(obj.seedSource) ? obj.seedSource : THEME_DEFAULTS.seedSource
        };
    },
    fallback: () => ({ ...THEME_DEFAULTS })
});

export const THEME_STORE = {
    load: (): ThemePrefs => store.get(),
    save(prefs: ThemePrefs): void {
        store.set(prefs);
    },
    _reset(): void {
        store._reset();
    }
};

