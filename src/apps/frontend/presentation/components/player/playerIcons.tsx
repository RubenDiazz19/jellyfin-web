// Iconos SVG del reproductor, en el mismo estilo hairline que theme/icons.
import type { ReactElement } from 'react';

type IconProps = { size?: number; stroke?: string; sw?: number };

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
    Replay10: ({ size = 24, sw = 1.5 }: IconProps): ReactElement => (
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
            >10</text>
        </svg>
    ),
    Forward10: ({ size = 24, sw = 1.5 }: IconProps): ReactElement => (
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
            >10</text>
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
    Settings: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
            <rect x='3.5' y='5.5' width='17' height='13' rx='2' stroke='currentColor' strokeWidth={sw} />
            <path d='M6.5 14.5h5M13.5 14.5h4M6.5 11h2M10.5 11h7' stroke='currentColor' strokeWidth={sw} strokeLinecap='round' />
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
