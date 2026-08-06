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
    type M3SchemeName
} from './m3';
import { analyzeImage, imageFocus, peekImageFocus } from './dynamicColor';

const STYLE_ID = 'jfp-m3-tokens';

/**
 * Paleta derivada junto con los parámetros que la produjeron. Van en el mismo
 * estado a propósito: es lo que garantiza que el CSS emitido sea coherente
 * consigo mismo aunque el scheme haya cambiado mientras se derivaba.
 */
type DerivedPalette = {
    colors: Record<string, string>;
    scheme: M3SchemeName;
    contrast: number;
};

/**
 * La derivación de la paleta se carga con `import()`: arrastra
 * @material/material-color-utilities (~100 KB) y solo la usan mobile y tablet.
 * Desktop —que ni siquiera activa el tema— no descarga nada de esto.
 *
 * La promesa se memoiza en el módulo: el provider se monta una vez, pero los
 * cambios de seed/scheme/contraste vuelven a pedirla y no deben re-descargar.
 */
let colorScheme: Promise<typeof import('./colorScheme')> | null = null;

function loadColorScheme() {
    colorScheme ??= import('./colorScheme');
    return colorScheme;
}

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
    /**
     * Punto de interés horizontal de una imagen, en % de su ancho, para
     * encuadrarla cuando el recorte se come casi todo el ancho (un fotograma
     * 16:9 en un hero vertical). `null` = no se pudo medir, o es escritorio,
     * donde el hero es apaisado y no hay nada que reencuadrar.
     */
    imageFocusX: (url: string) => Promise<number | null>;
    /**
     * El mismo encuadre pero ya memoizado y sin promesa. `undefined` = aún no
     * se sabe. Quien pinta la imagen lo consulta ANTES de su primer render:
     * con el valor a mano sale colocada de una, sin el deslizamiento de
     * corrección.
     */
    peekFocusX: (url: string) => number | null | undefined;
};

const noop = () => { /* desktop/tests sin provider: tema inerte */ };
const noFocus = () => Promise.resolve(null);
// En escritorio el encuadre se sabe desde el principio: no hay ninguno.
const noPeek = () => null;

const INERT: MobileThemeValue = {
    layout: null,
    scheme: 'dark',
    mode: 'dark',
    contrast: M3_CONTRAST.standard,
    seed: null,
    seedSource: 'auto',
    setMode: noop,
    setSeed: noop,
    applyImageSeed: noop,
    imageFocusX: noFocus,
    peekFocusX: noPeek
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
    //
    // Es un efecto y no un `useMemo` porque el derivador llega por `import()`
    // (ver loadColorScheme). Hasta que aterriza no hay tokens que inyectar,
    // que es el mismo estado por el que ya se pasaba antes del primer efecto.
    //
    // El scheme y el contraste con los que se derivó viajan CON la paleta:
    // `scheme` cambia al instante y la paleta tarda un tick, así que emitir el
    // CSS con el scheme nuevo y los colores viejos declararía
    // `--md-sys-color-scheme: light` sobre una paleta oscura.
    const [palette, setPalette] = useState<DerivedPalette | null>(null);
    useEffect(() => {
        if (!active) {
            setPalette(null);
            return;
        }
        let alive = true;
        void loadColorScheme().then(({ makeColorTokens }) => {
            if (!alive) return;
            setPalette({
                colors: makeColorTokens(seed ?? M3_DEFAULT_SEED, scheme, contrast),
                scheme,
                contrast
            });
        });
        return () => { alive = false; };
    }, [active, seed, scheme, contrast]);

    // Materializa los tokens. El <style> solo existe mientras el layout es
    // mobile/tablet: al pasar a desktop se retira y no queda rastro.
    useEffect(() => {
        if (!palette) return;
        let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            document.head.appendChild(el);
        }
        el.textContent = buildM3CssFromTokens(palette.colors, palette.scheme, palette.contrast);
        return () => { document.getElementById(STYLE_ID)?.remove(); };
    }, [palette]);

    // theme-color dinámico: la barra de estado del sistema sigue al surface
    // del tema. Solo mobile/tablet; al salir se restaura el valor original.
    useEffect(() => {
        if (!palette) return;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!(meta instanceof HTMLMetaElement)) return;
        const prev = meta.content;
        const surface = palette.colors['--md-sys-color-surface'];
        if (surface) meta.content = surface;
        return () => { meta.content = prev; };
    }, [palette]);

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
        void analyzeImage(url).then(({ seed: hex }) => {
            if (hex) themeVM.applyDynamicSeed(hex);
        });
    }, []);

    // Mismo guard, y el muestreo de píxeles se comparte con el del color: si
    // los dos piden la misma imagen a la vez, se decodifica una sola vez.
    const imageFocusX = useCallback((url: string) => {
        if (!currentMobileLayout() || !url) return Promise.resolve(null);
        return imageFocus(url);
    }, []);

    const peekFocusX = useCallback((url: string) => {
        if (!currentMobileLayout() || !url) return null;
        return peekImageFocus(url);
    }, []);

    const value = useMemo<MobileThemeValue>(() => (
        active ?
            {
                layout, scheme, mode, contrast, seed, seedSource,
                setMode, setSeed, applyImageSeed, imageFocusX, peekFocusX
            } :
            INERT
    ), [
        active, layout, scheme, mode, contrast, seed, seedSource,
        setMode, setSeed, applyImageSeed, imageFocusX, peekFocusX
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
