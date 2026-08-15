// El código de la aplicación (src/): globales del navegador, servicio de
// proyecto de TypeScript y las reglas que solo tienen sentido aquí.

import path from 'node:path';
import globals from 'globals';

export default [
    // App files
    {
        files: [
            'src/**/*.{js,jsx,ts,tsx}'
        ],
        languageOptions: {
            parserOptions: {
                project: path.resolve(import.meta.dirname, '../tsconfig.json'),
                tsconfigRootDir: path.resolve(import.meta.dirname, '..')
            },
            globals: {
                ...globals.browser,
                // Tizen globals
                'tizen': false,
                'webapis': false,
                // WebOS globals
                'webOS': false,
                // Dependency globals
                '$': false,
                'jQuery': false,
                // Jellyfin globals
                'ApiClient': true,
                'Events': true,
                'chrome': true,
                'Emby': false,
                'Hls': true,
                'LibraryMenu': true,
                'Windows': false,
                // Build time definitions
                __COMMIT_SHA__: false,
                __JF_BUILD_VERSION__: false,
                __PACKAGE_JSON_NAME__: false,
                __PACKAGE_JSON_VERSION__: false,
                __USE_SYSTEM_FONTS__: false,
                __WEBPACK_SERVE__: false
            }
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: path.resolve(import.meta.dirname, '../tsconfig.json')
                },
                node: {
                    extensions: [
                        '.js',
                        '.ts',
                        '.jsx',
                        '.tsx',
                        '.scss',
                        '.css'
                    ],
                    moduleDirectory: [
                        'node_modules',
                        'src'
                    ]
                }
            },
            polyfills: [
                'Promise',
                // whatwg-fetch
                'fetch',
                'Response',
                'Response.headers',
                'Response.json',
                // document-register-element
                'document.registerElement',
                // resize-observer-polyfill
                'ResizeObserver',
                // fast-text-encoding
                'TextEncoder',
                // intersection-observer
                'IntersectionObserver',
                // Core-js
                'Object.assign',
                'Object.is',
                'Object.setPrototypeOf',
                'Object.toString',
                'Object.freeze',
                'Object.seal',
                'Object.preventExtensions',
                'Object.isFrozen',
                'Object.isSealed',
                'Object.isExtensible',
                'Object.getOwnPropertyDescriptor',
                'Object.getPrototypeOf',
                'Object.keys',
                'Object.entries',
                'Object.getOwnPropertyNames',
                'Function.name',
                'Function.hasInstance',
                'Array.from',
                'Array.arrayOf',
                'Array.copyWithin',
                'Array.fill',
                'Array.find',
                'Array.findIndex',
                'Array.iterator',
                'String.fromCodePoint',
                'String.raw',
                'String.iterator',
                'String.codePointAt',
                'String.endsWith',
                'String.includes',
                'String.repeat',
                'String.startsWith',
                'String.trim',
                'String.anchor',
                'String.big',
                'String.blink',
                'String.bold',
                'String.fixed',
                'String.fontcolor',
                'String.fontsize',
                'String.italics',
                'String.link',
                'String.small',
                'String.strike',
                'String.sub',
                'String.sup',
                'URL',
                'URLSearchParams',
                'RegExp',
                'Number',
                'Math',
                'Date',
                'async',
                'Symbol',
                'Map',
                'Set',
                'WeakMap',
                'WeakSet',
                'ArrayBuffer',
                'DataView',
                'Int8Array',
                'Uint8Array',
                'Uint8ClampedArray',
                'Int16Array',
                'Uint16Array',
                'Int32Array',
                'Uint32Array',
                'Float32Array',
                'Float64Array',
                'Reflect'
            ]
        },
        rules: {
            // TODO: Add typescript recommended typed rules
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'default',
                    format: [ 'camelCase', 'PascalCase' ],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: 'variable',
                    format: [ 'camelCase', 'PascalCase', 'UPPER_CASE' ],
                    leadingUnderscore: 'allowSingleOrDouble',
                    trailingUnderscore: 'allowSingleOrDouble'
                },
                {
                    selector: 'typeLike',
                    format: [ 'PascalCase' ]
                },
                {
                    selector: 'enumMember',
                    format: [ 'PascalCase', 'UPPER_CASE' ]
                },
                {
                    selector: [ 'objectLiteralProperty', 'typeProperty' ],
                    format: [ 'camelCase', 'PascalCase' ],
                    leadingUnderscore: 'allowSingleOrDouble',
                    trailingUnderscore: 'allowSingleOrDouble'
                },
                // Ignore numbers, locale strings (en-us), aria/data attributes and CSS selectors
                {
                    selector: [ 'objectLiteralProperty', 'typeProperty' ],
                    format: null,
                    filter: {
                        regex: '[ &\\-]|^([0-9]+)$',
                        match: true
                    }
                }
            ],
            '@typescript-eslint/no-deprecated': 'warn',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/prefer-string-starts-ends-with': 'error'
        }
    }
];
