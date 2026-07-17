import type { Locale } from 'date-fns';
import enUS from 'date-fns/locale/en-US';

const LOCALE_MAP: Record<string, string> = {
    'af': 'af',
    'ar': 'ar-DZ',
    'be-by': 'be',
    'bg-bg': 'bg',
    'bn': 'bn',
    'ca': 'ca',
    'cs': 'cs',
    'cy': 'cy',
    'da': 'da',
    'de': 'de',
    'el': 'el',
    'en-gb': 'en-GB',
    'en-us': 'en-US',
    'eo': 'eo',
    'es': 'es',
    'es-ar': 'es',
    'es-do': 'es',
    'es-mx': 'es',
    'et': 'et',
    'eu': 'eu',
    'fa': 'fa-IR',
    'fi': 'fi',
    'fr': 'fr',
    'fr-ca': 'fr-CA',
    'gl': 'gl',
    'gsw': 'de',
    'he': 'he',
    'hi-in': 'hi',
    'hr': 'hr',
    'hu': 'hu',
    'id': 'id',
    'is': 'is',
    'it': 'it',
    'ja': 'ja',
    'kk': 'kk',
    'ko': 'ko',
    'lt-lt': 'lt',
    'lv': 'lv',
    'ms': 'ms',
    'nb': 'nb',
    'nl': 'nl',
    'nn': 'nn',
    'pl': 'pl',
    'pt': 'pt',
    'pt-br': 'pt-BR',
    'pt-pt': 'pt',
    'ro': 'ro',
    'ru': 'ru',
    'sk': 'sk',
    'sl-si': 'sl',
    'sv': 'sv',
    'ta': 'ta',
    'th': 'th',
    'tr': 'tr',
    'uk': 'uk',
    'vi': 'vi',
    'zh-cn': 'zh-CN',
    'zh-hk': 'zh-HK',
    'zh-tw': 'zh-TW'
};

const DEFAULT_LOCALE = 'en-US';

/**
 * Loaders for every date-fns locale the app can map to (see LOCALE_MAP).
 * Static import paths are required here: a fully dynamic specifier
 * (`date-fns/locale/${name}`) cannot be statically analyzed by bundlers or
 * resolved by the browser's module loader at runtime.
 */
/* eslint-disable @typescript-eslint/naming-convention -- keys are BCP 47 locale codes */
const LOCALE_LOADERS: Record<string, () => Promise<{ default: Locale }>> = {
    'af': () => import('date-fns/locale/af'),
    'ar-DZ': () => import('date-fns/locale/ar-DZ'),
    'be': () => import('date-fns/locale/be'),
    'bg': () => import('date-fns/locale/bg'),
    'bn': () => import('date-fns/locale/bn'),
    'ca': () => import('date-fns/locale/ca'),
    'cs': () => import('date-fns/locale/cs'),
    'cy': () => import('date-fns/locale/cy'),
    'da': () => import('date-fns/locale/da'),
    'de': () => import('date-fns/locale/de'),
    'el': () => import('date-fns/locale/el'),
    'en-GB': () => import('date-fns/locale/en-GB'),
    'en-US': () => import('date-fns/locale/en-US'),
    'eo': () => import('date-fns/locale/eo'),
    'es': () => import('date-fns/locale/es'),
    'et': () => import('date-fns/locale/et'),
    'eu': () => import('date-fns/locale/eu'),
    'fa-IR': () => import('date-fns/locale/fa-IR'),
    'fi': () => import('date-fns/locale/fi'),
    'fr': () => import('date-fns/locale/fr'),
    'fr-CA': () => import('date-fns/locale/fr-CA'),
    'gl': () => import('date-fns/locale/gl'),
    'he': () => import('date-fns/locale/he'),
    'hi': () => import('date-fns/locale/hi'),
    'hr': () => import('date-fns/locale/hr'),
    'hu': () => import('date-fns/locale/hu'),
    'id': () => import('date-fns/locale/id'),
    'is': () => import('date-fns/locale/is'),
    'it': () => import('date-fns/locale/it'),
    'ja': () => import('date-fns/locale/ja'),
    'kk': () => import('date-fns/locale/kk'),
    'ko': () => import('date-fns/locale/ko'),
    'lt': () => import('date-fns/locale/lt'),
    'lv': () => import('date-fns/locale/lv'),
    'ms': () => import('date-fns/locale/ms'),
    'nb': () => import('date-fns/locale/nb'),
    'nl': () => import('date-fns/locale/nl'),
    'nn': () => import('date-fns/locale/nn'),
    'pl': () => import('date-fns/locale/pl'),
    'pt': () => import('date-fns/locale/pt'),
    'pt-BR': () => import('date-fns/locale/pt-BR'),
    'ro': () => import('date-fns/locale/ro'),
    'ru': () => import('date-fns/locale/ru'),
    'sk': () => import('date-fns/locale/sk'),
    'sl': () => import('date-fns/locale/sl'),
    'sv': () => import('date-fns/locale/sv'),
    'ta': () => import('date-fns/locale/ta'),
    'th': () => import('date-fns/locale/th'),
    'tr': () => import('date-fns/locale/tr'),
    'uk': () => import('date-fns/locale/uk'),
    'vi': () => import('date-fns/locale/vi'),
    'zh-CN': () => import('date-fns/locale/zh-CN'),
    'zh-HK': () => import('date-fns/locale/zh-HK'),
    'zh-TW': () => import('date-fns/locale/zh-TW')
};
/* eslint-enable @typescript-eslint/naming-convention */

let localeString = DEFAULT_LOCALE;
let locale = enUS;

export function fetchLocale(localeName: string): Promise<Locale> {
    const loader = LOCALE_LOADERS[localeName] || LOCALE_LOADERS[DEFAULT_LOCALE];
    return loader().then(module => module.default);
}

export function normalizeLocale(localeName: string) {
    return LOCALE_MAP[localeName]
        || LOCALE_MAP[localeName.replace(/-.*/, '')]
        || DEFAULT_LOCALE;
}

export async function updateLocale(newLocale: string) {
    console.debug('[dateFnsLocale] updating date-fns locale', newLocale);
    localeString = normalizeLocale(newLocale);
    console.debug('[dateFnsLocale] mapped to date-fns locale', localeString);
    locale = await fetchLocale(localeString);
}

export function getLocale() {
    return locale;
}

export function getLocaleWithSuffix() {
    return {
        addSuffix: true,
        locale
    };
}
