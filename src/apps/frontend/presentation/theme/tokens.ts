// Fuente única de verdad para colores/tipografía y posiciones del hero.

export const T = {
    bg: '#000',
    fg: '#fff',
    dim: 'rgba(255,255,255,0.55)',
    hairline: 'rgba(255,255,255,0.12)',
    display: '"Noto Sans", system-ui, sans-serif',
    ui: '"Noto Sans", system-ui, sans-serif'
} as const;

export const HERO_POS = {
    Esquina:  { justify: 'flex-end', align: 'flex-start', text: 'left', pad: '0 72px 120px' },
    Inferior: { justify: 'flex-end', align: 'center', text: 'center', pad: '0 56px 120px' },
    Centro:   { justify: 'center', align: 'center', text: 'center', pad: '0 56px 128px' }
} as const;

export const HERO_SCRIM = { Sutil: 0.4, Media: 0.66, Intensa: 0.85 } as const;

export type HeroPosKey = keyof typeof HERO_POS;
export type HeroScrimKey = keyof typeof HERO_SCRIM;
