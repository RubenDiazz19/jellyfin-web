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

const Shuffle = ({ size = 18, stroke = 'currentColor', sw = 1.6 }: IconProps) => (
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
        <polyline points='16 3 21 3 21 8' />
        <line x1='4' y1='20' x2='21' y2='3' />
        <polyline points='21 16 21 21 16 21' />
        <line x1='15' y1='15' x2='21' y2='21' />
        <line x1='4' y1='4' x2='9' y2='9' />
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

const Server = ({ size = 18, stroke = 'currentColor', sw = 1.5 }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <rect x='2' y='3' width='20' height='7' rx='2' stroke={stroke} strokeWidth={sw} />
        <rect x='2' y='14' width='20' height='7' rx='2' stroke={stroke} strokeWidth={sw} />
        <line x1='6' y1='6.5' x2='6.01' y2='6.5' stroke={stroke} strokeWidth={sw * 1.5} strokeLinecap='round' />
        <line x1='6' y1='17.5' x2='6.01' y2='17.5' stroke={stroke} strokeWidth={sw * 1.5} strokeLinecap='round' />
    </svg>
);

const Trash = ({ size = 16, stroke = 'currentColor', sw = 1.5 }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <path d='M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' stroke={stroke} strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round' />
    </svg>
);

const Lock = ({ size = 14, stroke = 'currentColor', sw = 1.5 }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <rect x='5' y='11' width='14' height='10' rx='2' stroke={stroke} strokeWidth={sw} />
        <path d='M8 11V7a4 4 0 0 1 8 0v4' stroke={stroke} strokeWidth={sw} strokeLinecap='round' />
    </svg>
);

const User = ({ size = 18, stroke = 'currentColor', sw = 1.5 }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' stroke={stroke} strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round' />
        <circle cx='12' cy='7' r='4' stroke={stroke} strokeWidth={sw} />
    </svg>
);

const Key = ({ size = 16, stroke = 'currentColor', sw = 1.5 }: IconProps) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
        <circle cx='8' cy='15' r='4' stroke={stroke} strokeWidth={sw} />
        <path d='M10.85 12.15L19 4M18 5l2 2M15 8l2 2' stroke={stroke} strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round' />
    </svg>
);

export const Ic = { Play, Plus, Check, Search, Arrow, Imdb, Dot, Heart, Tick, Dots, Refresh, Shuffle, Server, Trash, Lock, User, Key };

// Silueta oficial del logo de Jellyfin como SVG inline (isotipo triangular).
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
            <path
                fill='currentColor'
                d='M12 .002C8.826.002-1.398 18.537.16 21.666c1.56 3.129 22.14 3.094 23.682 0S15.177 0 12 0zm7.76 18.949c-1.008 2.028-14.493 2.05-15.514 0C3.224 16.9 9.92 4.755 12.003 4.755c2.081 0 8.77 12.166 7.759 14.196zM12 9.198c-1.054 0-4.446 6.15-3.93 7.189c.518 1.04 7.348 1.027 7.86 0c.511-1.027-2.874-7.19-3.93-7.19z'
            />
        </svg>
    );
}
