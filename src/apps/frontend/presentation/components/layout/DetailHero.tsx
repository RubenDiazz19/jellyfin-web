// Piezas compartidas por el hero de la ficha de serie y el de la de
// película. Las dos fichas no son el mismo hero —cambian tamaños de logo,
// tipografía del título y qué metadatos se enseñan— pero el marco (alto,
// backdrop, degradado, colocación del bloque de texto), la fila de géneros y
// el bloque logo-o-título estaban copiados literalmente en las dos páginas.

import type { ReactNode } from 'react';
import { T, HERO_POS, HERO_SCRIM, type HeroPosKey, type HeroScrimKey } from '../../theme/tokens';
import { useResponsive } from '../../theme/responsive';
import { Backdrop } from './Backdrop';
import type { Navigate } from '../../../app/router';

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
    itemId: string;
    /** La barra de navegación va dentro del hero, sobre el backdrop. */
    nav: ReactNode;
    children: ReactNode;
    /**
     * Contenido dentro del hero pero fuera del bloque de texto, que se coloca
     * respecto al hero entero y no respecto al título (el aviso de scroll).
     */
    footer?: ReactNode;
};

/** Marco del hero: alto de pantalla, backdrop, degradado y colocación. */
export function HeroFrame({ hero, backdrop, backdrops, itemId, nav, children, footer }: FrameProps) {
    const { pos, scrim } = useHeroLayout(hero);
    const r = useResponsive();
    return (
        <section style={{
            position: 'relative',
            height: r.touch ? (r.mobile ? '68vh' : '78vh') : '100vh',
            minHeight: r.touch ? 420 : undefined,
            width: '100%', overflow: 'hidden', background: '#000'
        }}>
            {nav}
            <Backdrop src={backdrop} srcs={backdrops} fadeBottom={0.92} itemId={itemId} sharp />
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `linear-gradient(to top, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,${(scrim * 0.45).toFixed(2)}) 24%, transparent 56%)`
            }} />
            <div style={{
                position: 'absolute', inset: 0,
                padding: r.touch ? `0 ${r.pagePad + 4}px 36px` : pos.pad,
                display: 'flex', flexDirection: 'column',
                alignItems: pos.align, justifyContent: pos.justify,
                textAlign: pos.text
            }}>
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
                        {g}
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
    logoMaxHeight: number;
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
