// Iconos SVG del reproductor, en el mismo estilo hairline que theme/icons.
import type { ReactElement } from 'react';

type IconProps = { size?: number; stroke?: string; sw?: number };

/**
 * Los dos de saltar llevan escrito dentro cuánto saltan, y eso lo elige el
 * usuario en Ajustes: el número es un dato, no parte del dibujo.
 */
type SkipIconProps = IconProps & { seconds?: number };

export const PlayerIc = {
    Play: ({ size = 26 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path d='M7 4.5v15l13-7.5-13-7.5z' fill='currentColor' />
        </svg>
    ),
    Pause: ({ size = 26 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path d='M7.5 5v14M16.5 5v14' stroke='currentColor' strokeWidth={2.4} strokeLinecap='round' />
        </svg>
    ),
    Back: ({ size = 22, sw = 1.6 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path d='M15 5l-7 7 7 7' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round' />
        </svg>
    ),
    VolumeHigh: ({ size = 22, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path d='M4 9.5v5h3.5L12 18V6L7.5 9.5H4z' stroke='currentColor' strokeWidth={sw} strokeLinejoin='round' />
            <path d='M15.5 9a4.2 4.2 0 010 6M18 6.6a8 8 0 010 10.8' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' />
        </svg>
    ),
    VolumeMuted: ({ size = 22, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path d='M4 9.5v5h3.5L12 18V6L7.5 9.5H4z' stroke='currentColor' strokeWidth={sw} strokeLinejoin='round' />
            <path d='M15.5 9.5l5 5M20.5 9.5l-5 5' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' />
        </svg>
    ),
    Fullscreen: ({ size = 20, sw = 1.6 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round'
            />
        </svg>
    ),
    FullscreenExit: ({ size = 20, sw = 1.6 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round'
            />
        </svg>
    ),
    Replay: ({ size = 24, sw = 1.5, seconds = 10 }: SkipIconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M11.5 5.5a7.5 7.5 0 1 1-6.9 4.6'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
            <path
                d='M11.9 2.8L8.9 5.5l3 2.7'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round'
            />
            <text
                x='12' y='15.6' textAnchor='middle' fontSize='7' fontWeight='600'
                fill='currentColor' fontFamily='inherit'
            >{seconds}</text>
        </svg>
    ),
    Forward: ({ size = 24, sw = 1.5, seconds = 10 }: SkipIconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M12.5 5.5a7.5 7.5 0 1 0 6.9 4.6'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
            <path
                d='M12.1 2.8l3 2.7-3 2.7'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round'
            />
            <text
                x='12' y='15.6' textAnchor='middle' fontSize='7' fontWeight='600'
                fill='currentColor' fontFamily='inherit'
            >{seconds}</text>
        </svg>
    ),
    Cast: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M3 8.5V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-8.5'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
            <path
                d='M3 12a7 7 0 017 7M3 15.5A3.5 3.5 0 016.5 19M3 18.9v.1'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
        </svg>
    ),
    Pip: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M9.5 18.5H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v2.5'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
            <rect x='12.5' y='12.5' width='8.5' height='6.5' rx='1.5' stroke='currentColor' strokeWidth={sw} />
        </svg>
    ),
    Queue: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M3 6h12M3 11h12M3 16h7'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
            <path
                d='M15.5 14.2v5.6l4.7-2.8-4.7-2.8z'
                fill='currentColor' stroke='currentColor'
                strokeWidth={sw} strokeLinejoin='round'
            />
        </svg>
    ),
    // Engranaje macizo (8 dientes redondeados + agujero central): agrupa
    // capítulos, subtítulos, audio, velocidad y aspecto. El "agujero" sale de
    // dibujar el cuerpo como un anillo grueso, así queda transparente sobre
    // el vídeo en vez de recortado a un color fijo.
    Settings: ({ size = 20 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            {Array.from({ length: 8 }, (_, i) => (
                <rect
                    key={i}
                    x='10' y='1.5' width='4' height='4.3' rx='1.4'
                    fill='currentColor'
                    transform={`rotate(${i * 45} 12 12)`}
                />
            ))}
            <circle cx='12' cy='12' r='6.8' stroke='currentColor' strokeWidth='3.6' />
        </svg>
    ),
    // Doble flecha de avance rápido: saltar intro/créditos, ir al siguiente.
    SkipForward: ({ size = 18 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path d='M3 5.5v13l9-6.5-9-6.5zM12.5 5.5v13l9-6.5-9-6.5z' fill='currentColor' />
        </svg>
    ),
    // Barra dividida en tramos: los capítulos del item.
    Chapters: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <rect
                x='2.5' y='8.5' width='19' height='7' rx='2'
                stroke='currentColor' strokeWidth={sw}
            />
            <path d='M9 8.5v7M15 8.5v7' stroke='currentColor' strokeWidth={sw} />
        </svg>
    ),
    Subtitles: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <rect x='3.5' y='5.5' width='17' height='13' rx='2' stroke='currentColor' strokeWidth={sw} />
            <path d='M6.5 14.5h5M13.5 14.5h4M6.5 11h2M10.5 11h7' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' />
        </svg>
    ),
    AudioTrack: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M4.5 10v4M8.25 7.5v9M12 5v14M15.75 8.5v7M19.5 10.5v3'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
        </svg>
    ),
    Speed: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <path
                d='M4.5 16.5a8 8 0 1115 0'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
            <path d='M12 16.5l3.6-4.8' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' />
            <circle cx='12' cy='16.5' r='1' fill='currentColor' />
        </svg>
    ),
    AspectRatio: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <rect
                x='3' y='6' width='18' height='12' rx='1.5'
                stroke='currentColor' strokeWidth={sw}
            />
            <path
                d='M7 10v4M17 10v4'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
                opacity='0.55'
            />
        </svg>
    ),
    Brightness: ({ size = 22, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <circle cx='12' cy='12' r='4' stroke='currentColor' strokeWidth={sw} />
            <path
                d='M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4'
                stroke='currentColor' strokeWidth={sw} strokeLinecap='round'
            />
        </svg>
    ),
    Lock: ({ size = 22, sw = 1.6 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <rect x='5' y='10.5' width='14' height='9.5' rx='2' stroke='currentColor' strokeWidth={sw} />
            <path d='M8 10.5V7.5a4 4 0 018 0v3' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' />
        </svg>
    ),
    LockOpen: ({ size = 22, sw = 1.6 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <rect x='5' y='10.5' width='14' height='9.5' rx='2' stroke='currentColor' strokeWidth={sw} />
            <path d='M8 10.5V7.5a4 4 0 017.5-1.9' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' />
        </svg>
    ),
    Rotate: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <rect x='3' y='7' width='11' height='14' rx='2' stroke='currentColor' strokeWidth={sw} />
            <path d='M17 5a4 4 0 014 4M17 5V3M17 5h2' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' strokeLinejoin='round' />
        </svg>
    ),
    Spinner: ({ size = 54 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 50 50' className='jfp-video-spinner'>
            <circle
                cx='25' cy='25' r='20' fill='none' stroke='currentColor' strokeWidth='2.5'
                strokeLinecap='round' strokeDasharray='90 60'
            />
        </svg>
    )
};
