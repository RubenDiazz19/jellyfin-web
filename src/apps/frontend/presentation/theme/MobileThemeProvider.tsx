// Provider del tema Material 3 — SOLO actúa bajo layout-mobile/layout-tablet.
//
// En desktop (layout-desktop) es un passthrough total: no inyecta ningún
// <style>, no escucha prefers-color-scheme y el contexto queda inerte, así
// que la app conserva el tema dark hardcodeado actual sin cambio alguno.
//
// En mobile/tablet materializa los tokens --md-sys-* (m3.ts) en un <style>
// propio, sigue la preferencia dark/light/system del usuario (ThemeViewModel)
// y alimenta el dynamic color con el backdrop visible (Backdrop.tsx llama a
// applyImageSeed).

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode
} from 'react';

import { useSignalValue } from '../../domain/bridge/useViewModel';
import { themeVM, type SeedSource, type ThemeMode } from '../../domain/viewModels/ThemeViewModel';
import {
    currentMobileLayout,
    observeLayoutMode,
    type MobileLayout
} from '../../shared/layoutMode';
import {
    buildM3CssFromTokens,
    M3_ANIM_CLASS,
    M3_CONTRAST,
    M3_DEFAULT_SEED,
    makeColorTokens,
    type M3SchemeName
} from './m3';
import { seedFromImage } from './dynamicColor';

const STYLE_ID = 'jfp-m3-tokens';

type MobileThemeValue = {
    /** null = desktop/tv (tema inerte). */
    layout: MobileLayout | null;
    scheme: M3SchemeName;
    mode: ThemeMode;
    /** Nivel de contraste M3 activo (derivado de `prefers-contrast`). */
    contrast: number;
    /** Seed #rrggbb activa, o null si se usa la de por defecto. */
    seed: string | null;
    /** 'manual' = la eligió el usuario y el backdrop no la cambia. */
    seedSource: SeedSource;
    setMode: (mode: ThemeMode) => void;
    /** Fija la seed a mano; `null` devuelve el mando al dynamic color. */
    setSeed: (seed: string | null) => void;
    /** Dynamic color: alimenta la seed desde la URL del backdrop visible. */
    applyImageSeed: (url: string) => void;
};

const noop = () => { /* desktop/tests sin provider: tema inerte */ };

const INERT: MobileThemeValue = {
    layout: null,
    scheme: 'dark',
    mode: 'dark',
    contrast: M3_CONTRAST.standard,
    seed: null,
    seedSource: 'auto',
    setMode: noop,
    setSeed: noop,
    applyImageSeed: noop
};

const MobileThemeContext = createContext<MobileThemeValue>(INERT);

export function MobileThemeProvider({ children }: { children: ReactNode }) {
    const [layout, setLayout] = useState<MobileLayout | null>(currentMobileLayout);
    useEffect(() => observeLayoutMode(() => setLayout(currentMobileLayout())), []);
    const active = layout !== null;

    const mode = useSignalValue(themeVM.mode);
    const scheme = useSignalValue(themeVM.scheme);
    const seed = useSignalValue(themeVM.seed);
    const seedSource = useSignalValue(themeVM.seedSource);

    // prefers-color-scheme → systemDark (solo se escucha en mobile/tablet).
    useEffect(() => {
        if (!active || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => { themeVM.systemDark.value = mq.matches; };
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [active]);

    // prefers-contrast → nivel de contraste M3. Se consultan las dos queries
    // (more/less) porque no hay una sola con valor; `custom` y
    // `no-preference` caen en el estándar.
    const [contrast, setContrast] = useState<number>(M3_CONTRAST.standard);
    useEffect(() => {
        if (!active || typeof window.matchMedia !== 'function') return;
        const more = window.matchMedia('(prefers-contrast: more)');
        const less = window.matchMedia('(prefers-contrast: less)');
        const apply = () => {
            setContrast(
                more.matches ? M3_CONTRAST.more :
                    less.matches ? M3_CONTRAST.less :
                        M3_CONTRAST.standard
            );
        };
        apply();
        more.addEventListener('change', apply);
        less.addEventListener('change', apply);
        return () => {
            more.removeEventListener('change', apply);
            less.removeEventListener('change', apply);
        };
    }, [active]);

    // Preferencia remota (DisplayPreferences) al activarse en mobile/tablet.
    // Si no hay sesión aún, el pull falla en silencio y manda la local.
    useEffect(() => {
        if (active) void themeVM.pullFromServer();
    }, [active]);

    // La paleta se deriva UNA vez por cambio de seed/scheme/contraste: la
    // consumen tanto el <style> de tokens como el theme-color de abajo, y
    // derivar 53 roles dos veces por rotación del carrusel no es gratis.
    const colors = useMemo(
        () => (active ? makeColorTokens(seed ?? M3_DEFAULT_SEED, scheme, contrast) : null),
        [active, seed, scheme, contrast]
    );

    // Materializa los tokens. El <style> solo existe mientras el layout es
    // mobile/tablet: al pasar a desktop se retira y no queda rastro.
    useEffect(() => {
        if (!colors) return;
        let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            document.head.appendChild(el);
        }
        el.textContent = buildM3CssFromTokens(colors, scheme, contrast);
        return () => { document.getElementById(STYLE_ID)?.remove(); };
    }, [colors, scheme, contrast]);

    // theme-color dinámico: la barra de estado del sistema sigue al surface
    // del tema. Solo mobile/tablet; al salir se restaura el valor original.
    useEffect(() => {
        if (!colors) return;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!(meta instanceof HTMLMetaElement)) return;
        const prev = meta.content;
        const surface = colors['--md-sys-color-surface'];
        if (surface) meta.content = surface;
        return () => { meta.content = prev; };
    }, [colors]);

    // Transición suave al cambiar de tema (no en el primer render).
    const firstScheme = useRef(true);
    useEffect(() => {
        if (!active) return;
        if (firstScheme.current) {
            firstScheme.current = false;
            return;
        }
        const root = document.documentElement;
        root.classList.add(M3_ANIM_CLASS);
        const t = setTimeout(() => root.classList.remove(M3_ANIM_CLASS), 400);
        return () => {
            clearTimeout(t);
            root.classList.remove(M3_ANIM_CLASS);
        };
    }, [active, scheme]);

    const setMode = useCallback((m: ThemeMode) => { themeVM.setMode(m); }, []);

    const setSeed = useCallback((hex: string | null) => { themeVM.setSeed(hex); }, []);

    const applyImageSeed = useCallback((url: string) => {
        // Guard en vivo (no sobre `layout` capturado): así un desktop nunca
        // paga la decodificación de imagen aunque el estado esté desfasado.
        if (!currentMobileLayout() || !url) return;
        void seedFromImage(url).then((hex) => {
            if (hex) themeVM.applyDynamicSeed(hex);
        });
    }, []);

    const value = useMemo<MobileThemeValue>(() => (
        active ?
            {
                layout, scheme, mode, contrast, seed, seedSource,
                setMode, setSeed, applyImageSeed
            } :
            INERT
    ), [
        active, layout, scheme, mode, contrast, seed, seedSource,
        setMode, setSeed, applyImageSeed
    ]);

    return (
        <MobileThemeContext.Provider value={value}>
            {children}
        </MobileThemeContext.Provider>
    );
}

/** Inerte (dark, no-ops) fuera del provider o en desktop. */
export function useMobileTheme(): MobileThemeValue {
    return useContext(MobileThemeContext);
}
