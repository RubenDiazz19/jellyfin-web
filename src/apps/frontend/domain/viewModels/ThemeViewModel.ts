// ViewModel del tema M3 para mobile/tablet. Regla MVVM: sin React ni
// presentation/. El MobileThemeProvider (presentation) lee estos signals y
// materializa las CSS custom properties; en desktop nadie los consume y el
// tema actual queda intacto.

import { computed, signal } from '@preact/signals-core';

import {
    getServerThemePrefs,
    saveServerThemePrefs,
    type ServerThemePrefs
} from '../../data/api/theme';
import {
    isSeedColor,
    isThemeMode,
    THEME_STORE,
    type ThemeMode,
    type ThemePrefs
} from '../../data/stores/themeStore';

// Las Views consumen este tipo a través del ViewModel (presentation no
// puede importar de data/).
export type { ThemeMode };

type Store = Pick<typeof THEME_STORE, 'load' | 'save'>;
type SyncApi = {
    get: () => Promise<ServerThemePrefs | null>;
    save: (theme: { mode: string; seed: string | null }) => Promise<void>;
};

const DEFAULT_SYNC: SyncApi = { get: getServerThemePrefs, save: saveServerThemePrefs };

export class ThemeViewModel {
    /** Preferencia del usuario: dark | light | system. */
    mode = signal<ThemeMode>('dark');

    /** Estado de prefers-color-scheme; lo alimenta el provider. */
    systemDark = signal(true);

    /** Seed #rrggbb activa (manual o dinámica); null = seed por defecto. */
    seed = signal<string | null>(null);

    /** Esquema efectivo que el provider materializa en CSS. */
    scheme = computed<'dark' | 'light'>(() => (
        this.mode.value === 'system' ?
            (this.systemDark.value ? 'dark' : 'light') :
            this.mode.value
    ));

    constructor(
        private store: Store = THEME_STORE,
        private sync: SyncApi = DEFAULT_SYNC
    ) {
        const prefs = store.load();
        this.mode.value = prefs.mode;
        this.seed.value = prefs.seed;
    }

    /** Override manual del usuario. Persiste y se sube al server. */
    setMode(mode: ThemeMode) {
        if (!isThemeMode(mode) || mode === this.mode.value) return;
        this.mode.value = mode;
        this.persist(true);
    }

    /** Seed elegida a mano (o null para volver a la default). Se sube al server. */
    setSeed(seed: string | null) {
        if (seed !== null && !isSeedColor(seed)) return;
        const normalized = seed ? seed.toLowerCase() : null;
        if (normalized === this.seed.value) return;
        this.seed.value = normalized;
        this.persist(true);
    }

    /**
     * Dynamic color: seed extraída del backdrop visible. Persiste solo en
     * local — el carrusel del hero rota cada pocos segundos y no queremos
     * un POST al server por rotación.
     */
    applyDynamicSeed(seed: string) {
        if (!isSeedColor(seed)) return;
        const normalized = seed.toLowerCase();
        if (normalized === this.seed.value) return;
        this.seed.value = normalized;
        this.persist(false);
    }

    /** Trae la preferencia guardada en el server (si existe) y la aplica. */
    async pullFromServer(): Promise<void> {
        try {
            const remote = await this.sync.get();
            if (!remote) return;
            if (isThemeMode(remote.mode)) this.mode.value = remote.mode;
            if (isSeedColor(remote.seed)) this.seed.value = remote.seed.toLowerCase();
            this.persist(false);
        } catch {
            // Sin red o server sin la preferencia: manda la copia local.
        }
    }

    private persist(push: boolean) {
        const prefs: ThemePrefs = { mode: this.mode.value, seed: this.seed.value };
        this.store.save(prefs);
        if (push) {
            this.sync.save({ mode: prefs.mode, seed: prefs.seed }).catch(() => {
                // Offline: localStorage ya tiene la preferencia.
            });
        }
    }
}

export const themeVM = new ThemeViewModel();
