import { T } from '../../theme/tokens';

type PersonStatsProps = {
    gender?: string | null;
    age?: number | null;
    country?: string | null;
    countryCode?: string | null;
    birthCity?: string | null;
    isWidescreen?: boolean;
};

const COUNTRY_FLAGS: Array<{ keywords: string[]; flag: string }> = [
    { keywords: ['united states', 'usa', 'ee. uu.'], flag: '🇺🇸' },
    { keywords: ['uk', 'united kingdom', 'reino unido', 'england'], flag: '🇬🇧' },
    { keywords: ['spain', 'españa'], flag: '🇪🇸' },
    { keywords: ['france', 'francia'], flag: '🇫🇷' },
    { keywords: ['italy', 'italia'], flag: '🇮🇹' },
    { keywords: ['germany', 'alemania'], flag: '🇩🇪' },
    { keywords: ['canada', 'canadá'], flag: '🇨🇦' },
    { keywords: ['australia'], flag: '🇦🇺' },
    { keywords: ['japan', 'japon', 'japón'], flag: '🇯🇵' },
    { keywords: ['korea', 'corea'], flag: '🇰🇷' },
    { keywords: ['mexico', 'méxico'], flag: '🇲🇽' },
    { keywords: ['brazil', 'brasil'], flag: '🇧🇷' },
    { keywords: ['india'], flag: '🇮🇳' },
    { keywords: ['china'], flag: '🇨🇳' },
    { keywords: ['russia', 'rusia'], flag: '🇷🇺' },
    { keywords: ['argentina'], flag: '🇦🇷' },
    { keywords: ['colombia'], flag: '🇨🇴' },
    { keywords: ['chile'], flag: '🇨🇱' }
];

export function getFlagFallback(location: string): string {
    const loc = location.toLowerCase();
    const match = COUNTRY_FLAGS.find((c) => c.keywords.some((k) => loc.includes(k)));
    return match ? match.flag : '🏳️';
}

/**
 * Bloque visual con género, edad y bandera de nacionalidad (con ciudad de nacimiento)
 * para la ficha de persona.
 */
export function PersonStats({
    gender,
    age,
    country,
    countryCode,
    birthCity,
    isWidescreen
}: PersonStatsProps) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            justifyContent: isWidescreen ? 'flex-start' : 'center',
            textAlign: 'center'
        }}>
            {/* Género */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 84 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: T.ui }}>
                        {gender || '—'}
                    </span>
                </div>
                <div style={{ fontSize: 13, color: T.dim, marginTop: 1, fontFamily: T.ui }}>Género</div>
            </div>

            {/* Edad */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 84 }}>
                <div style={{ fontFamily: T.ui, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32 }}>
                    <span style={{ fontSize: 28, fontWeight: 700 }}>
                        {(age !== null && age !== undefined) ? age : '—'}
                    </span>
                </div>
                <div style={{ fontSize: 13, color: T.dim, marginTop: 1, fontFamily: T.ui }}>Años</div>
            </div>

            {/* Nacionalidad / Bandera — proporción 3:2 */}
            <div style={{
                position: 'relative',
                width: 78,
                height: 52,
                aspectRatio: '3 / 2',
                borderRadius: 6,
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.18)',
                background: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                {countryCode ? (
                    <img
                        src={`https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`}
                        alt={country || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <span style={{ fontSize: 24 }}>{getFlagFallback(country || '')}</span>
                )}

                {/* Degradado suave sólo en el tercio inferior */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 36%, rgba(0,0,0,0) 65%)'
                }} />

                {/* Texto en letrita pequeña abajo del todo dentro de la bandera */}
                <div style={{
                    position: 'absolute',
                    bottom: 3,
                    left: 3,
                    right: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pointerEvents: 'none'
                }}>
                    <span style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: '#fff',
                        fontFamily: T.ui,
                        lineHeight: 1.15,
                        textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%'
                    }}>
                        {country || '—'}
                    </span>
                    {birthCity && (
                        <span style={{
                            fontSize: 8,
                            fontWeight: 500,
                            color: 'rgba(255,255,255,0.9)',
                            fontFamily: T.ui,
                            lineHeight: 1.1,
                            textShadow: '0 1px 2px rgba(0,0,0,0.95)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                        }}>
                            {birthCity}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
