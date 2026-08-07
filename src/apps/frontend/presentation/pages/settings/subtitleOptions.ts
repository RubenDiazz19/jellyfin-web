// Las tres listas del bloque «apariencia de los subtítulos». Son las mismas
// opciones que ofrece el Jellyfin nativo, con sus mismas etiquetas: lo que
// cambia es dónde se aplican (ver domain/player/subtitleStyle).

import globalize from 'lib/globalize';

import type {
    SubtitleDropShadow, SubtitleFont, SubtitleTextSize
} from '../../../domain/player/subtitleStyle';

export function getSubtitleTextSizeOptions(): [SubtitleTextSize, string][] {
    return [
        ['smaller', globalize.translate('Smaller')],
        ['small', globalize.translate('Small')],
        ['medium', globalize.translate('Normal')],
        ['large', globalize.translate('Large')],
        ['larger', globalize.translate('Larger')],
        ['extralarge', globalize.translate('ExtraLarge')]
    ];
}

export function getSubtitleFontOptions(): [SubtitleFont, string][] {
    return [
        ['', globalize.translate('Default')],
        ['typewriter', globalize.translate('Typewriter')],
        ['print', globalize.translate('Print')],
        ['console', globalize.translate('Console')],
        ['cursive', globalize.translate('Cursive')],
        ['casual', globalize.translate('Casual')],
        ['smallcaps', globalize.translate('SmallCaps')]
    ];
}

export function getSubtitleDropShadowOptions(): [SubtitleDropShadow, string][] {
    return [
        ['uniform', globalize.translate('Uniform')],
        ['dropshadow', globalize.translate('DropShadow')],
        ['raised', globalize.translate('Raised')],
        ['depressed', globalize.translate('Depressed')],
        ['none', globalize.translate('None')]
    ];
}
