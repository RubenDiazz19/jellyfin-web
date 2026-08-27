// Piezas compartidas por el hero de la ficha de serie y el de la de
// película. Las dos fichas no son el mismo hero —cambian tamaños de logo,
// tipografía del título y qué metadatos se enseñan— pero el marco (alto,
// backdrop, degradado, colocación del bloque de texto), la fila de géneros y
// el bloque logo-o-título estaban copiados literalmente en las dos páginas.

import type { MouseEvent, ReactNode } from 'react';
import { T, HERO_POS, HERO_SCRIM, type HeroPosKey, type HeroScrimKey } from '../../theme/tokens';
import { useResponsive, useShortViewport } from '../../theme/responsive';
import { Backdrop } from './Backdrop';
import { NAV_BOTTOM_VAR, NAV_LEFT_VAR } from '../nav/navMetrics';
import type { Navigate } from '../../../app/router';
import { translateGenre } from '../../../domain/genres';

/**
 * Alto del hero de ficha: la pantalla entera, igual que el de la portada. Lo
 * de debajo (sinopsis, reparto, datos) aparece al desplazar.
 *
 * En táctil se mide sobre `--jfp-viewport-h` (global.css) y no en `svh`
 * directo: donde no exista la unidad, la variable ya trae `100vh` de respaldo.
 * Un `svh` suelto sería una declaración inválida, el alto se quedaría en
 * `auto` y —con el contenido en absoluto— el hero colapsaría a cero.
 */
export function heroHeight(touch: boolean): string {
    return touch ? 'var(--jfp-viewport-h, 100vh)' : '100vh';
}

export type HeroTweaks = {
    heroPos?: HeroPosKey;
    heroInfo?: 'Mínima' | 'Completa';
    heroScrim?: HeroScrimKey;
};

/** Los tres ajustes del hero ya resueltos a valores concretos. */
export function useHeroLayout(hero?: HeroTweaks) {
    const pos = HERO_POS[hero?.heroPos ?? 'Esquina'];
    return {
        pos,
        minimal: hero?.heroInfo === 'Mínima',
        scrim: HERO_SCRIM[hero?.heroScrim ?? 'Media'],
        // Con el texto pegado a la esquina, lo que va encima y debajo del
        // título se alinea con él en vez de centrarse.
        inlineJustify: pos.justify === 'flex-end' && pos.align === 'flex-start' ?
            'flex-start' :
            'center'
    };
}

type FrameProps = {
    hero?: HeroTweaks;
    /** Imagen principal y rotación de fondos. */
    backdrop: string;
    backdrops?: string[];
    /** Con él, un fondo puesto a mano para ese item manda sobre el del server. */
    itemId?: string;
    /** La barra de navegación va dentro del hero, sobre el backdrop. */
    nav: ReactNode;
    children: ReactNode;
    /**
     * Contenido dentro del hero pero fuera del bloque de texto, que se coloca
     * respecto al hero entero y no respecto al título (el aviso de scroll).
     */
    footer?: ReactNode;
    /**
     * Colocación fija. La usan las fichas que no exponen los ajustes del hero
     * (temporada y episodio); en las demás manda lo que haya elegido el
     * usuario en `hero`.
     */
    pos?: HeroPosKey;
    /** Relleno de escritorio, cuando la ficha no quiere el de su colocación. */
    pad?: string;
    /**
     * Opacidad del degradado inferior. A 0 se quita: la ficha de temporada ya
     * oscurece el fondo entero y encima lleva un número gigante que no
     * necesita más contraste.
     */
    scrim?: number;
    /**
     * Fondo prestado —la ficha de temporada enseña la imagen de la serie— que
     * se desenfoca y oscurece para que se lea como textura y no como la
     * imagen de lo que estás mirando.
     */
    blurred?: boolean;
    /**
     * Clic derecho sobre el hero. Lo usa la ficha de una colección, cuyo hero
     * va sin un solo botón encima: el menú de la imagen se abre desde aquí.
     */
    onContextMenu?: (e: MouseEvent) => void;
};

/** Marco del hero: alto de pantalla, backdrop, degradado y colocación. */
export function HeroFrame({
    hero, backdrop, backdrops, itemId, nav, children, footer, pos, pad, scrim, blurred,
    onContextMenu
}: FrameProps) {
    const layout = useHeroLayout(hero);
    const place = pos ? HERO_POS[pos] : layout.pos;
    const scrimAlpha = scrim ?? layout.scrim;
    const r = useResponsive();
    const short = useShortViewport();
    return (
        <section onContextMenu={onContextMenu} style={{
            position: 'relative',
            height: heroHeight(r.touch),
            // A sangre en táctil: el body reserva el hueco del rail (tablet) y
            // del safe-area, y aquí se devuelve para que el fondo del hero
            // llegue al borde; la IMAGEN se recorta al área útil desde
            // Backdrop, alineada con el contenido. El lado derecho no se toca:
            // nada desborda.
            marginLeft: r.touch ? `calc(-1 * var(${NAV_LEFT_VAR}, 0px))` : undefined,
            width: r.touch ? `calc(100% + var(${NAV_LEFT_VAR}, 0px))` : '100%',
            overflow: 'hidden', background: '#000'
        }}>
            {nav}
            <Backdrop src={backdrop} srcs={backdrops} itemId={itemId} sharp blurred={blurred} />
            {scrimAlpha > 0 && (
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: `linear-gradient(to top, rgba(0,0,0,${scrimAlpha}) 0%, rgba(0,0,0,${(scrimAlpha * 0.45).toFixed(2)}) 24%, transparent 56%)`
                }} />
            )}
            {/* jfp-hero-content: en táctil impide que los hijos encojan. Un
                flex en columna reparte el recorte entre todos cuando no cabe
                el bloque, y encoger la CAJA de un texto no encoge el texto:
                se salía y se pintaba encima del vecino (título sobre título en
                la ficha de episodio). Prefiere desbordar por arriba, que el
                degradado disimula. */}
            <div
                className='jfp-hero-content'
                style={{
                    position: 'absolute', inset: 0,
                    // Ahora el hero ocupa la pantalla entera, así que la
                    // píldora de navegación flota sobre su parte de abajo: el
                    // bloque de texto le deja su hueco.
                    padding: r.touch ?
                        'calc(56px + env(safe-area-inset-top, 0px))'
                            + ` calc(${r.pagePad + 4}px + env(safe-area-inset-right, 0px))`
                            + ` calc(var(${NAV_BOTTOM_VAR}, 24px) + ${short ? 8 : 20}px)`
                            + ` calc(${r.pagePad + 4}px + var(${NAV_LEFT_VAR}, 0px))` :
                        pad ?? place.pad,
                    display: 'flex', flexDirection: 'column',
                    alignItems: place.align, justifyContent: place.justify,
                    textAlign: place.text
                }}
            >
                {children}
            </div>
            {footer}
        </section>
    );
}

type GenresProps = {
    genres: string[];
    navigate: Navigate;
    fontSize: number;
    marginBottom: number;
    justifyContent: string;
};

/** Géneros del item, cada uno navegable a su listado. */
export function HeroGenres({ genres, navigate, fontSize, marginBottom, justifyContent }: GenresProps) {
    return (
        <div style={{
            fontFamily: T.ui, fontSize, letterSpacing: 4, textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)', marginBottom,
            display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent
        }}>
            {genres.map((g, i) => (
                <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); navigate({ page: 'genre', genre: g }); }}
                        style={{
                            background: 'none', border: 'none', padding: 0,
                            font: 'inherit', color: 'inherit',
                            letterSpacing: 'inherit', textTransform: 'inherit',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                    >
                        {translateGenre(g)}
                    </button>
                    {i < genres.length - 1 && <span style={{ opacity: 0.5 }}>·</span>}
                </span>
            ))}
        </div>
    );
}

type TitleProps = {
    logo?: string | null;
    title: string;
    /** Series y películas usan escalas distintas: la ficha manda la suya. */
    logoMaxWidth: string | number;
    logoMaxHeight: string | number;
    logoShadow: string;
    fontSize: string;
    letterSpacing: number;
    /** El título de película equilibra líneas; el de serie no. */
    balance?: boolean;
};

/** El logo del item si lo tiene; si no, su título en grande. */
export function HeroTitle({
    logo, title, logoMaxWidth, logoMaxHeight, logoShadow, fontSize, letterSpacing, balance
}: TitleProps) {
    if (logo) {
        return (
            <img
                src={logo}
                alt={title}
                decoding='async'
                style={{
                    maxWidth: logoMaxWidth, maxHeight: logoMaxHeight,
                    width: 'auto', height: 'auto',
                    filter: `drop-shadow(0 4px 60px ${logoShadow})`, objectFit: 'contain'
                }}
            />
        );
    }
    return (
        <h1 style={{
            fontFamily: T.display, fontSize, lineHeight: 0.92,
            margin: 0, fontWeight: 250, letterSpacing,
            textShadow: '0 4px 60px rgba(0,0,0,0.6)',
            ...(balance ? { textWrap: 'balance' as const } : {})
        }}>
            {title}
        </h1>
    );
}
