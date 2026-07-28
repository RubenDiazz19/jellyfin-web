import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import {
    clearAllTitleLanguagePrefs, countTitleLanguagePrefs,
    getMaxStreamingBitrate, setMaxStreamingBitrate,
    type UserConfig
} from '../../../domain/api';
import { useSession } from '../../../domain/bridge/useSession';
import { useToast } from '../../components/toast/ToastProvider';
import { getBitrateOptions, getLanguageOptions } from './options';
import { SectionTitle, SelectBox, SettingRow, Toggle } from './ui';
import { T } from '../../theme/tokens';

export function PlaybackSection({
    config, patch
}: {
    config: UserConfig; patch: (p: Partial<UserConfig>) => void;
}) {
    const toast = useToast();
    const { session } = useSession();
    const [bitrate, setBitrate] = useState(getMaxStreamingBitrate());
    // Títulos con idioma propio: se fija al elegir pista en el reproductor y
    // manda sobre lo de aquí, así que desde aquí se puede volver atrás.
    const userId = session?.userId ?? '';
    const [titlePrefs, setTitlePrefs] = useState(0);
    useEffect(() => setTitlePrefs(countTitleLanguagePrefs(userId)), [userId]);

    return (
        <div>
            <SectionTitle>{globalize.translate('TitlePlayback')}</SectionTitle>

            <SettingRow
                label={globalize.translate('LabelAudioLanguagePreference')}
                hint={globalize.translate('LabelAudioLanguagePreferenceHelp')}
            >
                <SelectBox
                    value={config.AudioLanguagePreference ?? ''}
                    options={getLanguageOptions()}
                    onChange={(v) => patch({ AudioLanguagePreference: v })}
                />
            </SettingRow>

            {titlePrefs > 0 && (
                <SettingRow
                    label={globalize.translate('LabelTitleLanguageOverrides')}
                    hint={globalize.translate('LabelTitleLanguageOverridesHelp', String(titlePrefs))}
                >
                    <button
                        onClick={() => {
                            clearAllTitleLanguagePrefs(userId);
                            setTitlePrefs(0);
                            toast(globalize.translate('SettingsSaved'), 'success');
                        }}
                        style={{
                            padding: '8px 14px', fontFamily: T.ui, fontSize: 13,
                            color: T.fg, background: 'rgba(255,255,255,0.08)',
                            border: 'none', borderRadius: 8, cursor: 'pointer'
                        }}
                    >
                        {globalize.translate('ButtonForget')}
                    </button>
                </SettingRow>
            )}

            <SettingRow
                label={globalize.translate('LabelPlayDefaultAudioTrack')}
                hint={globalize.translate('LabelPlayDefaultAudioTrackHelp')}
            >
                <Toggle
                    on={config.PlayDefaultAudioTrack}
                    onChange={(v) => patch({ PlayDefaultAudioTrack: v })}
                />
            </SettingRow>

            <SettingRow
                label={globalize.translate('LabelRememberAudioSelections')}
                hint={globalize.translate('LabelRememberAudioSelectionsHelp')}
            >
                <Toggle
                    on={config.RememberAudioSelections}
                    onChange={(v) => patch({ RememberAudioSelections: v })}
                />
            </SettingRow>

            <SettingRow
                label={globalize.translate('LabelRememberSubtitleSelections')}
                hint={globalize.translate('LabelRememberSubtitleSelectionsHelp')}
            >
                <Toggle
                    on={config.RememberSubtitleSelections}
                    onChange={(v) => patch({ RememberSubtitleSelections: v })}
                />
            </SettingRow>

            <SettingRow
                label={globalize.translate('PlayNextEpisodeAutomatically')}
                hint={globalize.translate('PlayNextEpisodeAutomaticallyHelp')}
            >
                <Toggle
                    on={config.EnableNextEpisodeAutoPlay}
                    onChange={(v) => patch({ EnableNextEpisodeAutoPlay: v })}
                />
            </SettingRow>

            <SettingRow
                label={globalize.translate('LabelMaxStreamingBitrate')}
                hint={globalize.translate('LabelMaxStreamingBitrateHelp')}
            >
                <SelectBox
                    value={String(bitrate)}
                    options={getBitrateOptions().map(([v, l]) => [String(v), l] as [string, string])}
                    onChange={(v) => {
                        const bps = Number(v);
                        setMaxStreamingBitrate(bps);
                        setBitrate(bps);
                        toast(globalize.translate('MessageQualitySaved'), 'success');
                    }}
                />
            </SettingRow>
        </div>
    );
}
