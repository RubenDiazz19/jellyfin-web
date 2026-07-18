// Iconos SVG del reproductor, en el mismo estilo hairline que theme/icons.
import type { ReactElement } from 'react';

type IconProps = { size?: number; stroke?: string; sw?: number };

export const PlayerIc = {
    Play: ({ size = 26 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M7 4.5v15l13-7.5-13-7.5z" fill="currentColor" />
        </svg>
    ),
    Pause: ({ size = 26 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M7.5 5v14M16.5 5v14" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
    ),
    Back: ({ size = 22, sw = 1.6 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    VolumeHigh: ({ size = 22, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
            <path d="M15.5 9a4.2 4.2 0 010 6M18 6.6a8 8 0 010 10.8" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        </svg>
    ),
    VolumeMuted: ({ size = 22, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
            <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        </svg>
    ),
    Fullscreen: ({ size = 20, sw = 1.6 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path
                d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
                stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
            />
        </svg>
    ),
    FullscreenExit: ({ size = 20, sw = 1.6 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path
                d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"
                stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
            />
        </svg>
    ),
    Settings: ({ size = 20, sw = 1.5 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth={sw} />
            <path d="M6.5 14.5h5M13.5 14.5h4M6.5 11h2M10.5 11h7" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        </svg>
    ),
    Spinner: ({ size = 54 }: IconProps): ReactElement => (
        <svg width={size} height={size} viewBox="0 0 50 50" className="jfp-video-spinner">
            <circle
                cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeDasharray="90 60"
            />
        </svg>
    )
};
