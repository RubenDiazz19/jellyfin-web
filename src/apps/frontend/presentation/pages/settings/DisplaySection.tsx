import { useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import {
    getAvailableLocales, getLocalePrefs, setLocalePrefs,
    type LocalePrefs, type UserConfig
} from '../../../domain/api';
import { useToast } from '../../components/toast/ToastProvider';
import { getLocaleOptions } from './options';
import { SectionStatus, SectionTitle, SelectBox, SettingRow, Toggle } from './ui';

// Lo que el Jellyfin nativo llama «Visualización»: idioma de la interfaz,
// formato de fecha y las dos opciones de catálogo que el servidor aplica al
// responder (episodios que faltan y lo ya visto en «Últimas»).
//
// Las dos primeras no son configuración del usuario sino DisplayPreferences,
// así que van por su propio camino y no por `patch`. Ver data/api/preferences.
export function DisplaySection({
    config, patch
}: {
    config: UserConfig; patch: (p: Partial<UserConfig>) => void;
}) {
    const toast = useToast();
    const [locales, setLocales] = useState<string[] | null>(null);
    const [prefs, setPrefs] = useState<LocalePrefs | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        Promise.all([getAvailableLocales(), getLocalePrefs()])
            .then(([all, current]) => {
                setLocales(all);
                setPrefs(current);
            })
            .catch((e) => setError((e as Error).message));
    }, []);

    /**
     * Cambiar el idioma recarga la app.
     *
     * globalize sí se entera al vuelo —vuelve a bajar el diccionario—, pero lo
     * que ya está pintado se quedaría con los textos viejos hasta que cada
     * pantalla se volviera a montar por su cuenta, con lo que la mitad de la
     * interfaz quedaría en un idioma y la otra mitad en otro. Recargar es
     * instantáneo (la sesión y la ruta se conservan) y deja todo coherente.
     */
    const changeLocale = async (attempted: Partial<LocalePrefs>, reload: boolean) => {
        const previous = prefs;
        if (!previous) return;
        setBusy(true);
        setPrefs({ ...previous, ...attempted });
        try {
            await setLocalePrefs(attempted);
            if (reload) window.location.reload();
            else toast(globalize.translate('SettingsSaved'), 'success');
        } catch (e) {
            setPrefs(previous);
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    };

    const localeOptions = locales ? getLocaleOptions(locales) : [];

    return (
        <div>
            <SectionTitle>{globalize.translate('Display')}</SectionTitle>
            <SectionStatus error={error} loaded={!!prefs} />

            {prefs && (
                <>
                    <SettingRow
                        label={globalize.translate('LabelDisplayLanguage')}
                        hint={globalize.translate('LabelDisplayLanguageHelp')}
                    >
                        <SelectBox
                            value={prefs.language}
                            options={localeOptions}
                            disabled={busy}
                            onChange={(v) => { void changeLocale({ language: v }, true); }}
                        />
                    </SettingRow>

                    <SettingRow
                        label={globalize.translate('LabelDateTimeLocale')}
                        hint={globalize.translate('LabelDateTimeLocaleHelp')}
                    >
                        <SelectBox
                            value={prefs.dateTimeLocale}
                            options={localeOptions}
                            disabled={busy}
                            onChange={(v) => { void changeLocale({ dateTimeLocale: v }, false); }}
                        />
                    </SettingRow>
                </>
            )}

            <SettingRow
                label={globalize.translate('DisplayMissingEpisodesWithinSeasons')}
                hint={globalize.translate('DisplayMissingEpisodesWithinSeasonsHelp')}
            >
                <Toggle
                    on={config.DisplayMissingEpisodes}
                    onChange={(v) => patch({ DisplayMissingEpisodes: v })}
                />
            </SettingRow>

            <SettingRow
                label={globalize.translate('HideWatchedContentFromLatestMedia')}
                hint={globalize.translate('HideWatchedContentFromLatestMediaHelp')}
            >
                <Toggle
                    on={config.HidePlayedInLatest}
                    onChange={(v) => patch({ HidePlayedInLatest: v })}
                />
            </SettingRow>
        </div>
    );
}
