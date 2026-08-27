// Set de iconos SVG hairline compartido por todo el prototipo.
import type { CSSProperties } from 'react';

type IconProps = { size?: number; fill?: string; stroke?: string; sw?: number };

const Play = ({ size = 24, fill = 'currentColor' }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <path d='M7 4.5v15l13-7.5-13-7.5z' fill={fill} />
    </svg>
);

const Plus = ({ size = 16, stroke = 'currentColor', sw = 1.4 }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <path d='M12 5v14M5 12h14' stroke={stroke} strokeWidth={sw} strokeLinecap='round' />
    </svg>
);

const Check = ({ size = 14, stroke = '#000', sw = 1.6 }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <path
            d='M5 12.5l4.5 4.5L19 7.5'
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const Search = ({ size = 18, stroke = 'currentColor', sw = 1.4 }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <circle cx='11' cy='11' r='6.5' stroke={stroke} strokeWidth={sw} />
        <path d='M16 16l4 4' stroke={stroke} strokeWidth={sw} strokeLinecap='round' />
    </svg>
);

const Arrow = ({ size = 14, dir = 'left' }: { size?: number; dir?: 'left' | 'right' }) => (
    <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        style={{ transform: dir === 'right' ? 'rotate(180deg)' : 'none' }}
    >
        <path
            d='M14 6l-6 6 6 6'
            stroke='currentColor'
            strokeWidth='1.5'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const IMDB_STYLE: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5c518',
    color: '#000',
    fontWeight: 800,
    fontSize: 9,
    padding: '2px 4px',
    borderRadius: 2,
    letterSpacing: 0.5,
    lineHeight: 1,
    fontFamily: 'system-ui'
};

const Imdb = () => <span style={IMDB_STYLE}>IMDb</span>;

const DOT_STYLE: CSSProperties = {
    width: 4,
    height: 4,
    borderRadius: 999,
    background: 'currentColor',
    opacity: 0.5,
    display: 'inline-block'
};

const Dot = () => <span style={DOT_STYLE} />;

const Heart = ({ size = 18, filled = false }: { size?: number; filled?: boolean }) => (
    <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill={filled ? '#fff' : 'none'}
        stroke='#fff'
        strokeWidth='1.7'
        strokeLinejoin='round'
        style={{ transition: 'fill .25s', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))' }}
    >
        <path d='M12 20.7l-1.34-1.22C5.9 15.16 3 12.52 3 9.28 3 6.66 5.04 4.6 7.6 4.6c1.45 0 2.84.68 3.74 1.76L12 7.1l.66-.74A4.86 4.86 0 0 1 16.4 4.6C18.96 4.6 21 6.66 21 9.28c0 3.24-2.9 5.88-7.66 10.2L12 20.7z' />
    </svg>
);

const Tick = ({ size = 18, filled = false }: { size?: number; filled?: boolean }) => (
    <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='#fff'
        strokeWidth={filled ? 2.8 : 1.7}
        strokeLinecap='round'
        strokeLinejoin='round'
        style={{
            opacity: filled ? 1 : 0.8,
            transition: 'all .2s',
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))'
        }}
    >
        <path d='M5 12.5l4.5 4.5L19 6.8' />
    </svg>
);

const Refresh = ({ size = 16, stroke = 'currentColor', sw = 1.7 }: IconProps) => (
    <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <path d='M21 12a9 9 0 1 1-3-6.7' />
        <path d='M21 3v6h-6' />
    </svg>
);

const Dots = ({ size = 18 }: { size?: number }) => (
    <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='#fff'
        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))', display: 'block' }}
    >
        <circle cx='12' cy='5' r='1.5' />
        <circle cx='12' cy='12' r='1.5' />
        <circle cx='12' cy='19' r='1.5' />
    </svg>
);

export const Ic = { Play, Plus, Check, Search, Arrow, Imdb, Dot, Heart, Tick, Dots, Refresh };

// Silueta del logo de Jellyfin como SVG inline. No reproduce el PNG a color
// (es un perfil blanco) sino que da un fallback estable cuando el asset falla
// —otro servidor, base path distinto, proxy que traga imágenes, etc.— para que
// la nav nunca se quede con el icono roto del navegador.
export function JellyfinLogo({ size = 22, style }: { size?: number; style?: CSSProperties }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox='0 0 24 24'
            fill='none'
            style={{ display: 'block', ...style }}
            aria-hidden='true'
        >
            {/* Cabeza: cúpula redondeada */}
            <path
                d='M5 10.5C5 6.4 8.1 3 12 3s7 3.4 7 7.5'
                fill='#fff'
            />
            {/* Bandeau horizontal: separa la cúpula de los tentáculos */}
            <rect x='5' y='9' width='14' height='2.2' rx='1.1' fill='#fff' />
            {/* Tentáculos colgantes */}
            <path
                d='M8 11.8v5.7c0 .9-.7 1.5-1.5 1.5S5 18.4 5 17.5M12 11.8v6.7c0 .8-.7 1.5-1.5 1.5S9 19.3 9 18.5M14 11.8v6.7c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5M18 11.8v5.7c0 .9.7 1.5 1.5 1.5s1.5-.6 1.5-1.5'
                fill='#fff'
            />
        </svg>
    );
}
