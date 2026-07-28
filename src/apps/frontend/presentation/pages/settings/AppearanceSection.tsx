import globalize from 'lib/globalize';

import type { ThemeMode } from '../../../domain/viewModels/ThemeViewModel';
import { useMobileTheme } from '../../theme/MobileThemeProvider';
import { MC } from '../../theme/responsive';
import { T } from '../../theme/tokens';
import { SectionTitle } from './ui';

// Solo móvil/tablet: el tema M3 no se aplica en el layout de escritorio.
export function AppearanceSection() {
    const { mode, setMode } = useMobileTheme();
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
                                borderBottom: `1px solid ${MC.outlineVariant}`,
                                color: 'inherit', fontFamily: T.ui
                            }}
                        >
                            <span style={{
                                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                border: `2px solid ${active ? MC.primary : MC.onSurfaceVariant}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {active && (
                                    <span style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        background: MC.primary
                                    }} />
                                )}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15 }}>{label}</div>
                                <div style={{ fontSize: 12, color: MC.onSurfaceVariant, marginTop: 2 }}>
                                    {hint}
                                </div>
                            </span>
                        </button>
                    );
                })}
            </div>
            <div style={{ fontSize: 12, color: MC.onSurfaceVariant, marginTop: 18, lineHeight: 1.5 }}>
                {globalize.translate('ThemeMobileOnlyHelp')}
            </div>
        </div>
    );
}
