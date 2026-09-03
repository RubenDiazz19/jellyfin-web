import globalize from 'lib/globalize';

import type { ThemeMode } from '../../../domain/viewModels/ThemeViewModel';
import { useMobileTheme } from '../../theme/MobileThemeProvider';
import { M3_DEFAULT_SEED } from '../../theme/m3';
import { C, T } from '../../theme/tokens';
import { SectionTitle } from './ui';

// Semillas de la paleta manual: una por zona del círculo de color, para que
// se distingan de un vistazo. La muestra que se ve ES el color fuente, que
// con SchemeContent es también el primary-container del tema.
const SEEDS: ReadonlyArray<readonly [string, string]> = [
    [M3_DEFAULT_SEED, 'ColorBlue'],
    ['#00bfa5', 'ColorTeal'],
    ['#43a047', 'ColorGreen'],
    ['#ffb300', 'ColorAmber'],
    ['#f4511e', 'ColorOrange'],
    ['#e53935', 'ColorRed'],
    ['#d81b60', 'ColorPink'],
    ['#8e24aa', 'ColorPurple']
];

// Solo móvil/tablet: el tema M3 no se aplica en el layout de escritorio.
export function AppearanceSection() {
    const { mode, setMode, seed, seedSource, setSeed } = useMobileTheme();
    const auto = seedSource === 'auto';
    const options: [ThemeMode, string, string][] = [
        ['system', globalize.translate('ThemeFollowSystem'), globalize.translate('ThemeFollowSystemHelp')],
        ['dark', globalize.translate('ThemeDark'), globalize.translate('ThemeDarkHelp')],
        ['light', globalize.translate('ThemeLight'), globalize.translate('ThemeLightHelp')]
    ];

    return (
        <div>
            <SectionTitle>{globalize.translate('Appearance')}</SectionTitle>
            <div role='radiogroup' aria-label={globalize.translate('LabelTheme')}>
                {options.map(([value, label, hint]) => {
                    const active = mode === value;
                    return (
                        <button
                            key={value}
                            role='radio'
                            aria-checked={active}
                            onClick={() => setMode(value)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                                textAlign: 'left', padding: '14px 4px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                borderBottom: `1px solid ${C.outlineVariant}`,
                                color: 'inherit', fontFamily: T.ui
                            }}
                        >
                            <span style={{
                                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                border: `2px solid ${active ? C.primary : C.onSurfaceVariant}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {active && (
                                    <span style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        background: C.primary
                                    }} />
                                )}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15 }}>{label}</div>
                                <div style={{ fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 }}>
                                    {hint}
                                </div>
                            </span>
                        </button>
                    );
                })}
            </div>
            <SectionTitle style={{ marginTop: 30 }}>
                {globalize.translate('LabelAccentColor')}
            </SectionTitle>
            <div
                role='radiogroup'
                aria-label={globalize.translate('LabelAccentColor')}
                style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '2px 0 4px' }}
            >
                {/* Automático: el arcoíris dice «esto lo decide la imagen». */}
                <Swatch
                    label={globalize.translate('AccentColorAuto')}
                    active={auto}
                    background='conic-gradient(#e53935, #ffb300, #43a047, #00a4dc, #8e24aa, #e53935)'
                    onClick={() => setSeed(null)}
                />
                {SEEDS.map(([hex, key]) => (
                    <Swatch
                        key={hex}
                        label={globalize.translate(key)}
                        active={!auto && seed === hex}
                        background={hex}
                        onClick={() => setSeed(hex)}
                    />
                ))}
            </div>
            <div style={{ fontSize: 12, color: C.onSurfaceVariant, marginTop: 10, lineHeight: 1.5 }}>
                {globalize.translate(auto ? 'AccentColorAutoHelp' : 'AccentColorManualHelp')}
            </div>

            <div style={{ fontSize: 12, color: C.onSurfaceVariant, marginTop: 18, lineHeight: 1.5 }}>
                {globalize.translate('ThemeMobileOnlyHelp')}
            </div>
        </div>
    );
}

function Swatch({
    label, active, background, onClick
}: {
    label: string; active: boolean; background: string; onClick: () => void;
}) {
    return (
        <button
            role='radio'
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={onClick}
            style={{
                width: 44, height: 44, borderRadius: '50%',
                background, border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                // El aro exterior marca la selección sin tapar el color: el
                // primer anillo es del fondo y el segundo, del acento.
                boxShadow: active ?
                    `0 0 0 3px ${C.surface}, 0 0 0 5px ${C.primary}` :
                    'none',
                transition: 'box-shadow var(--md-sys-motion-duration-short4, 200ms)'
                    + ' var(--md-sys-motion-easing-standard, cubic-bezier(0.2, 0, 0, 1))'
            }}
        >
            {active && (
                <span aria-hidden='true' style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.45)',
                    color: '#fff', fontSize: 12, lineHeight: '18px', fontFamily: T.ui
                }}
                >
                    ✓
                </span>
            )}
        </button>
    );
}
