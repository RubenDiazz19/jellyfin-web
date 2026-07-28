import globalize from 'lib/globalize';

import type { SubtitleMode, UserConfig } from '../../../domain/api';
import { getLanguageOptions, getSubtitleModeOptions } from './options';
import { SectionTitle, SelectBox, SettingRow } from './ui';

export function SubtitleSection({
    config, patch
}: {
    config: UserConfig; patch: (p: Partial<UserConfig>) => void;
}) {
    const modes = getSubtitleModeOptions();
    const current = modes.find(([m]) => m === config.SubtitleMode);

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
        </div>
    );
}
