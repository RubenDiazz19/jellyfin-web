import { useState } from 'react';

import globalize from 'lib/globalize';

import type { SubtitleMode, UserConfig } from '../../../domain/api';
import {
    getSubtitleAppearance, setSubtitleAppearance,
    type SubtitleAppearance
} from '../../../domain/player/subtitleStyle';
import { getLanguageOptions, getSubtitleModeOptions } from './options';
import {
    getSubtitleDropShadowOptions, getSubtitleFontOptions, getSubtitleTextSizeOptions
} from './subtitleOptions';
import { SubtitlePreview } from './SubtitlePreview';
import { SectionTitle, SelectBox, SettingRow } from './ui';
import { T } from '../../theme/tokens';

export function SubtitleSection({
    config, patch
}: {
    config: UserConfig; patch: (p: Partial<UserConfig>) => void;
}) {
    const modes = getSubtitleModeOptions();
    const current = modes.find(([m]) => m === config.SubtitleMode);
    // La apariencia no es configuración del servidor sino del reproductor de
    // este dispositivo, así que va por su cuenta y se guarda al momento.
    const [look, setLook] = useState<SubtitleAppearance>(getSubtitleAppearance);

    const patchLook = (p: Partial<SubtitleAppearance>) => setLook(setSubtitleAppearance(p));

    return (
        <div>
            <SectionTitle>{globalize.translate('Subtitles')}</SectionTitle>

            <SettingRow
                label={globalize.translate('LabelPreferredSubtitleLanguage')}
                hint={globalize.translate('LabelPreferredSubtitleLanguageHelp')}
            >
                <SelectBox
                    value={config.SubtitleLanguagePreference ?? ''}
                    options={getLanguageOptions()}
                    onChange={(v) => patch({ SubtitleLanguagePreference: v })}
                />
            </SettingRow>

            <SettingRow label={globalize.translate('LabelSubtitleMode')} hint={current?.[2] ?? ''}>
                <SelectBox
                    value={config.SubtitleMode}
                    options={modes.map(([v, l]) => [v, l] as [string, string])}
                    onChange={(v) => patch({ SubtitleMode: v as SubtitleMode })}
                />
            </SettingRow>

            <SectionTitle style={{ marginTop: 44 }}>
                {globalize.translate('HeaderSubtitleAppearance')}
            </SectionTitle>

            {/* Lo que se está eligiendo, tal cual va a verse sobre el vídeo. */}
            <SubtitlePreview appearance={look} />

            <SettingRow label={globalize.translate('LabelTextSize')}>
                <SelectBox
                    value={look.textSize}
                    options={getSubtitleTextSizeOptions()}
                    onChange={(v) => patchLook({ textSize: v as SubtitleAppearance['textSize'] })}
                />
            </SettingRow>

            <SettingRow label={globalize.translate('LabelFont')}>
                <SelectBox
                    value={look.font}
                    options={getSubtitleFontOptions()}
                    onChange={(v) => patchLook({ font: v as SubtitleAppearance['font'] })}
                />
            </SettingRow>

            <SettingRow label={globalize.translate('LabelTextColor')}>
                <ColorField
                    value={look.textColor}
                    onChange={(v) => patchLook({ textColor: v })}
                />
            </SettingRow>

            <SettingRow label={globalize.translate('LabelTextBackgroundColor')}>
                <ColorField
                    value={look.textBackground}
                    transparentLabel={globalize.translate('None')}
                    onChange={(v) => patchLook({ textBackground: v })}
                />
            </SettingRow>

            <SettingRow label={globalize.translate('LabelDropShadow')}>
                <SelectBox
                    value={look.dropShadow}
                    options={getSubtitleDropShadowOptions()}
                    onChange={(v) => patchLook({ dropShadow: v as SubtitleAppearance['dropShadow'] })}
                />
            </SettingRow>

            <SettingRow
                label={globalize.translate('LabelSubtitleVerticalPosition')}
                hint={globalize.translate('SubtitleVerticalPositionHelp')}
            >
                <input
                    type='number'
                    min={-16}
                    max={16}
                    value={look.verticalPosition}
                    onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) patchLook({ verticalPosition: n });
                    }}
                    style={{
                        width: 90, background: 'rgba(255,255,255,0.06)', color: T.fg,
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                        padding: '9px 12px', fontFamily: T.ui, fontSize: 13, outline: 'none'
                    }}
                />
            </SettingRow>

            <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.6, marginTop: 18 }}>
                {globalize.translate('SubtitleAppearanceSettingsDisclaimer')}
            </div>
        </div>
    );
}

/**
 * Un color, con su muestra. `transparent` no es un color que el selector del
 * sistema sepa enseñar, así que el «sin fondo» va como casilla aparte y el
 * selector se apaga mientras está marcada.
 */
function ColorField({
    value, transparentLabel, onChange
}: {
    value: string; transparentLabel?: string; onChange: (v: string) => void;
}) {
    const transparent = value === 'transparent';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {transparentLabel && (
                <label style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 13, color: T.dim, cursor: 'pointer'
                }}>
                    <input
                        type='checkbox'
                        checked={transparent}
                        onChange={(e) => onChange(e.target.checked ? 'transparent' : '#000000')}
                    />
                    {transparentLabel}
                </label>
            )}
            <input
                type='color'
                value={transparent ? '#000000' : value}
                disabled={transparent}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: 52, height: 34, padding: 2, cursor: transparent ? 'default' : 'pointer',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                    opacity: transparent ? 0.4 : 1
                }}
            />
        </div>
    );
}
