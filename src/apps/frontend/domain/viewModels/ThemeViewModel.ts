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
    type SeedSource,
    type ThemeMode,
    type ThemePrefs
} from '../../data/stores/themeStore';

// Las Views consumen estos tipos a través del ViewModel (presentation no
// puede importar de data/).
export type { SeedSource, ThemeMode };

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

    /** 'manual' congela la seed elegida en Ajustes: el dynamic color no pisa. */
    seedSource = signal<SeedSource>('auto');

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
        this.seedSource.value = prefs.seedSource;
    }

    /** Override manual del usuario. Persiste y se sube al server. */
    setMode(mode: ThemeMode) {
        if (!isThemeMode(mode) || mode === this.mode.value) return;
        this.mode.value = mode;
        this.persist(true);
    }

    /**
     * Seed elegida a mano en Ajustes; `null` devuelve el mando al dynamic
     * color. Se sube al server, y mientras sea manual el backdrop deja de
     * cambiar el color.
     */
    setSeed(seed: string | null) {
        if (seed !== null && !isSeedColor(seed)) return;
        const normalized = seed ? seed.toLowerCase() : null;
        const source: SeedSource = normalized ? 'manual' : 'auto';
        if (normalized === this.seed.value && source === this.seedSource.value) return;
        this.seed.value = normalized;
        this.seedSource.value = source;
        this.persist(true);
    }

    /**
     * Dynamic color: seed extraída del backdrop visible. Persiste solo en
     * local — el carrusel del hero rota cada pocos segundos y no queremos
     * un POST al server por rotación. Con una seed manual elegida no hace
     * nada: quien la eligió no quiere que la imagen se la cambie.
     */
    applyDynamicSeed(seed: string) {
        if (this.seedSource.value === 'manual') return;
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
            // Al server solo suben las seeds elegidas a mano (las dinámicas se
            // guardan en local), así que una seed remota es, por definición,
            // una elección del usuario en otro dispositivo.
            if (isSeedColor(remote.seed)) {
                this.seed.value = remote.seed.toLowerCase();
                this.seedSource.value = 'manual';
            }
            this.persist(false);
        } catch {
            // Sin red o server sin la preferencia: manda la copia local.
        }
    }

    private persist(push: boolean) {
        const prefs: ThemePrefs = {
            mode: this.mode.value,
            seed: this.seed.value,
            seedSource: this.seedSource.value
        };
        this.store.save(prefs);
        if (push) {
            this.sync.save({ mode: prefs.mode, seed: prefs.seed }).catch(() => {
                // Offline: localStorage ya tiene la preferencia.
            });
        }
    }
}

export const themeVM = new ThemeViewModel();
