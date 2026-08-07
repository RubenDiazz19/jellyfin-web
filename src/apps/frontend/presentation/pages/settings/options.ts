// Listas de opciones de los ajustes. Viven aparte de las secciones porque
// son datos puros y así se pueden testear sin montar React.

import globalize from 'lib/globalize';

import type { SubtitleMode } from '../../../domain/api';

// Códigos ISO 639-2/B, que es lo que guarda Jellyfin en las preferencias de
// idioma. Los nombres los pone Intl en el idioma activo, así que no hay que
// mantener una tabla de traducciones por idioma.
const LANGUAGE_CODES = ['spa', 'eng', 'jpn', 'fre', 'ger', 'ita', 'por', 'rus', 'kor', 'chi', 'ara'];

export function getLanguageOptions(): [string, string][] {
    const displayNames = new Intl.DisplayNames([globalize.getCurrentLocale()], { type: 'language' });

    return [
        ['', globalize.translate('AnyLanguage')],
        ...LANGUAGE_CODES.map((code): [string, string] => [
            code,
            // Intl devuelve el código tal cual si no lo conoce.
            displayNames.of(code) ?? code
        ])
    ];
}

export function getSubtitleModeOptions(): [SubtitleMode, string, string][] {
    return [
        ['Default', globalize.translate('MediaInfoDefault'), globalize.translate('SubtitleModeDefaultHelp')],
        ['Smart', globalize.translate('Smart'), globalize.translate('SubtitleModeSmartHelp')],
        ['OnlyForced', globalize.translate('OnlyForcedSubtitles'), globalize.translate('OnlyForcedSubtitlesHelp')],
        ['Always', globalize.translate('AlwaysPlaySubtitles'), globalize.translate('SubtitleModeAlwaysHelp')],
        ['None', globalize.translate('Never'), globalize.translate('SubtitleModeNoneHelp')]
    ];
}

/**
 * Los idiomas con traducción, con su nombre escrito en el idioma activo.
 *
 * Los códigos del diccionario no son todos BCP 47: unos cuantos llevan guion
 * bajo (`es_419`, `ur_pk`), que `Intl` no entiende. Se normalizan solo para
 * preguntar el nombre; el valor que se guarda es el código tal cual, que es lo
 * que el cargador de diccionarios espera.
 */
export function getLocaleOptions(locales: string[]): [string, string][] {
    const displayNames = new Intl.DisplayNames([globalize.getCurrentLocale()], {
        type: 'language',
        fallback: 'code'
    });

    const named = locales.map((code): [string, string] => {
        let name = code;
        try {
            name = displayNames.of(code.replace('_', '-')) ?? code;
        } catch {
            // Un código que Intl rechaza se queda con el suyo propio.
        }
        return [code, name];
    });
    named.sort((a, b) => a[1].localeCompare(b[1], globalize.getCurrentLocale()));

    return [['', globalize.translate('Auto')], ...named];
}

/** Longitudes de salto, en segundos: las mismas que ofrece el nativo. */
const SKIP_LENGTHS = [5, 10, 15, 20, 25, 30];

export function getSkipLengthOptions(): [string, string][] {
    return SKIP_LENGTHS.map((s): [string, string] => [
        String(s),
        globalize.translate('ValueSeconds', s)
    ]);
}

const BITRATE_TIERS: [number, string][] = [
    [4_000_000, 'StreamingQualitySd'],
    [8_000_000, 'StreamingQualityHdConstrained'],
    [10_000_000, 'StreamingQualityHd'],
    [15_000_000, 'StreamingQualityFullHd'],
    [20_000_000, 'StreamingQualityFullHdHigh'],
    [40_000_000, 'StreamingQuality4k'],
    [60_000_000, 'StreamingQuality4kHigh'],
    [120_000_000, 'StreamingQualityUnlimited']
];

export function getBitrateOptions(): [number, string][] {
    return BITRATE_TIERS.map(([bps, key]): [number, string] => [
        bps,
        `${bps / 1_000_000} Mbps — ${globalize.translate(key)}`
    ]);
}
