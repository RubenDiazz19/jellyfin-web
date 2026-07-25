// @ts-check
//
// Formateo: este proyecto NO usa Prettier. El estilo lo fija @stylistic desde
// aquí (indentación, comillas, comas, saltos, espaciado de JSX…) y se aplica
// con `bun run lint --fix`.
//
// La decisión es deliberada, no un pendiente: Prettier reformatearía sus
// propias reglas sobre las de @stylistic y habría que desactivar la mitad de
// este bloque (eslint-config-prettier) para que no se peleen, con lo que se
// perdería el control fino que ya está afinado aquí — por ejemplo el operador
// ternario multilínea o el espaciado de los genéricos, que Prettier impone a
// su manera. Con un solo formateador hay una sola fuente de verdad y un solo
// comando en CI.
//
// Si algún día se cambia de idea: añadir prettier + eslint-config-prettier al
// final de la lista de configs, y borrar de aquí las reglas @stylistic
// puramente tipográficas.

import eslint from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import compat from 'eslint-plugin-compat';
import globals from 'globals';
// @ts-expect-error Missing type definition
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import restrictedGlobals from 'confusing-browser-globals';
import sonarjs from 'eslint-plugin-sonarjs';
import stylistic from '@stylistic/eslint-plugin';
// eslint-disable-next-line import/no-unresolved
import tseslint from 'typescript-eslint';

/**
 * Por qué no React.FC: no aporta nada que no dé tipar el parámetro de props
 * (el tipo de retorno se infiere), obliga a un genérico para las props, no
 * admite componentes genéricos sin rodeos y arrastra el `children` implícito
 * que React 18 ya quitó, lo que hace que un componente acepte hijos aunque no
 * los pinte. Es también lo que recomiendan los tipos oficiales de React.
 */
const FC_MESSAGE = 'No uses React.FC: declara el componente como función normal '
    + 'y tipa las props en el parámetro — `function Foo({ a }: Props)`. '
    + 'Si necesita hijos, decláralos en Props (`children: ReactNode`).';

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    // @ts-expect-error Harmless type mismatch in dependency
    comments.recommended,
    compat.configs['flat/recommended'],
    importPlugin.flatConfigs.errors,
    sonarjs.configs.recommended,

    reactPlugin.configs.flat.recommended,
    // tsconfig usa jsx: react-jsx (runtime automático): importar React en
    // cada componente ya no es necesario.
    reactPlugin.configs.flat['jsx-runtime'],
    {
        settings: {
            react: {
                version: 'detect'
            }
        }
    },
    jsxA11y.flatConfigs.recommended,

    // Global ignores
    {
        ignores: [
            'node_modules',
            'coverage',
            'dist',
            '.idea',
            '.vscode',
            // Datos persistentes del docker-compose de desarrollo (config del
            // servidor, caché y biblioteca). Están en .gitignore, pero eslint
            // no lo lee: sin esto intenta parsear los .js que el propio
            // Jellyfin escribe ahí y `bun run lint` falla entero.
            'docker-config',
            'docker-cache',
            'docker-media'
        ]
    },

    // Global style rules
    {
        plugins: {
            '@stylistic': stylistic
        },
        extends: [ importPlugin.flatConfigs.typescript ],
        rules: {
            'array-callback-return': ['error', { 'checkForEach': true }],
            'curly': ['error', 'multi-line', 'consistent'],
            'default-case-last': 'error',
            'max-params': ['error', 7],
            'new-cap': [
                'error',
                {
                    'newIsCapExceptionPattern': String.raw`\.default$`
                }
            ],
            'no-duplicate-imports': 'error',
            'no-empty-function': 'error',
            'no-extend-native': 'error',
            'no-lonely-if': 'error',
            'no-nested-ternary': 'error',
            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': ['error', { builtinGlobals: false }],
            'no-restricted-globals': ['error'].concat(restrictedGlobals),
            'no-restricted-properties': [
                'error',
                {
                    property: 'replaceChildren',
                    message: 'replaceChildren is not supported in all target browsers'
                }
            ],
            'no-return-assign': 'error',
            'no-return-await': 'error',
            'no-sequences': ['error', { 'allowInParentheses': false }],
            'no-shadow': 'off',
            '@typescript-eslint/no-shadow': 'error',
            'no-throw-literal': 'error',
            'no-undef-init': 'error',
            'no-unneeded-ternary': 'error',
            'no-unused-expressions': 'off',
            '@typescript-eslint/no-unused-expressions': ['error', { 'allowShortCircuit': true, 'allowTernary': true, 'allowTaggedTemplates': true }],
            'no-unused-private-class-members': 'error',
            '@typescript-eslint/no-unused-vars': 'error',
            'no-useless-rename': 'error',
            'no-useless-constructor': 'off',
            '@typescript-eslint/no-useless-constructor': 'error',
            'no-var': 'error',
            'no-void': ['error', { 'allowAsStatement': true }],
            'no-warning-comments': ['warn', { 'terms': ['hack', 'xxx'] }],
            'one-var': ['error', 'never'],
            'prefer-const': ['error', { 'destructuring': 'all' }],
            'prefer-promise-reject-errors': ['warn', { 'allowEmptyReject': true }],
            '@typescript-eslint/prefer-for-of': 'error',
            'radix': 'error',
            'yoda': 'error',

            'sonarjs/fixme-tag': 'warn',
            'sonarjs/todo-tag': 'off',
            'sonarjs/deprecation': 'off',
            'sonarjs/no-alphabetical-sort': 'warn',
            'sonarjs/no-inverted-boolean-check': 'error',
            'sonarjs/no-selector-parameter': 'off',
            'sonarjs/pseudo-random': 'warn',
            'sonarjs/aws-restricted-ip-admin-access': 'off',
            // TODO: Enable the following sonarjs rules and fix issues
            'sonarjs/no-duplicate-string': 'off',
            'sonarjs/no-nested-functions': 'warn',
            // NOTE: This rule is currently blowing up `TypeError: secretSignatures[fqn].forEach is not a function`
            'sonarjs/hardcoded-secret-signatures': 'off',

            // TODO: Replace with stylistic.configs.customize()
            '@stylistic/block-spacing': 'error',
            '@stylistic/brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
            '@stylistic/comma-dangle': ['error', 'never'],
            '@stylistic/comma-spacing': 'error',
            '@stylistic/eol-last': 'error',
            '@stylistic/indent': ['error', 4, { 'SwitchCase': 1 }],
            '@stylistic/jsx-quotes': ['error', 'prefer-single'],
            '@stylistic/keyword-spacing': 'error',
            '@stylistic/max-statements-per-line': 'error',
            '@stylistic/no-floating-decimal': 'error',
            '@stylistic/no-mixed-spaces-and-tabs': 'error',
            '@stylistic/no-multi-spaces': 'error',
            '@stylistic/no-multiple-empty-lines': ['error', { 'max': 1 }],
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/object-curly-spacing': ['error', 'always'],
            '@stylistic/operator-linebreak': ['error', 'before', { overrides: { '?': 'after', ':': 'after', '=': 'after' } }],
            '@stylistic/padded-blocks': ['error', 'never'],
            '@stylistic/quotes': ['error', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': false }],
            '@stylistic/semi': 'error',
            '@stylistic/space-before-blocks': 'error',
            '@stylistic/space-infix-ops': 'error',

            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@jellyfin/sdk/lib/generated-client',
                            message: 'Use direct file imports for tree-shaking',
                            allowTypeImports: true
                        },
                        {
                            name: '@jellyfin/sdk/lib/generated-client/api',
                            message: 'Use direct file imports for tree-shaking',
                            allowTypeImports: true
                        },
                        {
                            name: '@jellyfin/sdk/lib/generated-client/models',
                            message: 'Use direct file imports for tree-shaking',
                            allowTypeImports: true
                        },
                        {
                            name: '@mui/icons-material',
                            message: 'Use direct file imports for tree-shaking',
                            allowTypeImports: true
                        },
                        {
                            name: '@mui/material',
                            message: 'Use direct file imports for tree-shaking',
                            allowTypeImports: true
                        }
                    ]
                }
            ]
        }
    },

    // Config files use node globals
    {
        ignores: [ 'src' ],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },

    // Config files are commonjs by default
    {
        files: [ '**/*.{cjs,js}' ],
        ignores: [ 'src' ],
        languageOptions: {
            sourceType: 'commonjs'
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off'
        }
    },

    // App files
    {
        files: [
            'src/**/*.{js,jsx,ts,tsx}'
        ],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
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
                node: {
                    extensions: [
                        '.js',
                        '.ts',
                        '.jsx',
                        '.tsx'
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
    },

    // React files
    {
        files: [ 'src/**/*.{jsx,tsx}' ],
        plugins: {
            'react-hooks': reactHooks
        },
        rules: {
            'react/jsx-filename-extension': ['error', { 'extensions': ['.jsx', '.tsx'] }],
            'react/jsx-no-bind': 'error',
            'react/jsx-no-useless-fragment': 'error',
            'react/no-array-index-key': 'error',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            // Convención: los componentes se tipan por sus props, no con
            // React.FC (ver CONTRIBUTING). En `warn` porque queda código
            // legacy sin migrar; en src/apps/frontend, que ya está limpio,
            // se sube a error más abajo.
            '@typescript-eslint/no-restricted-types': ['warn', {
                types: {
                    'React.FC': { message: FC_MESSAGE },
                    'React.FunctionComponent': { message: FC_MESSAGE },
                    FC: { message: FC_MESSAGE },
                    FunctionComponent: { message: FC_MESSAGE }
                }
            }]
        }
    },

    // Service worker
    {
        files: [ 'src/serviceworker.js' ],
        languageOptions: {
            globals: {
                ...globals.serviceworker
            }
        }
    },

    // Fronteras MVVM del frontend custom:
    //   View (presentation/) no importa de data/ — solo ViewModels/bridge.
    //   ViewModel (domain/viewModels/) no importa de presentation/ ni React.
    {
        files: [ 'src/apps/frontend/**/*.{ts,tsx}' ],
        rules: {
            'import/no-restricted-paths': ['error', {
                zones: [
                    {
                        target: './src/apps/frontend/presentation',
                        from: './src/apps/frontend/data',
                        message: 'View no puede importar de data/. Usa domain/viewModels/ o las fachadas de domain/.'
                    },
                    {
                        target: './src/apps/frontend/domain/viewModels',
                        from: './src/apps/frontend/presentation',
                        message: 'ViewModel no puede importar de presentation/.'
                    },
                    {
                        target: './src/apps/frontend/data',
                        from: './src/apps/frontend/presentation',
                        message: 'Model no puede importar de presentation/.'
                    }
                ]
            }]
        }
    },
    // El frontend custom es una app de prototipado rápido con estilo propio:
    // se relajan las reglas de opinión (inline handlers, ternarios anidados,
    // any puntuales) manteniendo las de corrección.
    {
        files: [ 'src/apps/frontend/**/*.{ts,tsx}' ],
        rules: {
            'react/jsx-no-bind': 'off',
            'react/no-array-index-key': 'off',
            'sonarjs/prefer-read-only-props': 'off',
            'sonarjs/no-nested-conditional': 'off',
            'sonarjs/cognitive-complexity': 'off',
            'sonarjs/no-clear-text-protocols': 'off',
            'no-nested-ternary': 'off',
            'no-empty-function': 'off',
            // no-floating-promises exige void; void-use lo prohíbe — gana TS.
            'sonarjs/void-use': 'off',
            '@stylistic/max-statements-per-line': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'jsx-a11y/no-static-element-interactions': 'off',
            'jsx-a11y/click-events-have-key-events': 'off',
            'jsx-a11y/no-autofocus': 'off',
            // Aquí no hay ni un React.FC: se blinda para que no entre.
            '@typescript-eslint/no-restricted-types': ['error', {
                types: {
                    'React.FC': { message: FC_MESSAGE },
                    'React.FunctionComponent': { message: FC_MESSAGE },
                    FC: { message: FC_MESSAGE },
                    FunctionComponent: { message: FC_MESSAGE }
                }
            }]
        }
    },
    {
        files: [ 'src/apps/frontend/domain/viewModels/**/*.ts' ],
        rules: {
            'no-restricted-imports': ['error', {
                paths: [
                    { name: 'react', message: 'ViewModel no puede importar React. Usa signals.' },
                    { name: 'react-dom', message: 'ViewModel no puede importar React. Usa signals.' }
                ],
                patterns: [{
                    group: ['react-router*', '@preact/signals-react*'],
                    message: 'ViewModel no puede depender de React ni de su router.'
                }]
            }]
        }
    },

    // Legacy JS (less strict)
    {
        files: [ 'src/**/*.{js,jsx}' ],
        rules: {
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-this-alias': 'off',

            'sonarjs/public-static-readonly': 'off',

            // TODO: Enable the following rules and fix issues
            'sonarjs/cognitive-complexity': 'off',
            'sonarjs/constructor-for-side-effects': 'off',
            'sonarjs/function-return-type': 'off',
            'sonarjs/no-async-constructor': 'off',
            'sonarjs/no-duplicate-string': 'off',
            'sonarjs/no-ignored-exceptions': 'off',
            'sonarjs/no-invariant-returns': 'warn',
            'sonarjs/no-nested-functions': 'off',
            'sonarjs/void-use': 'off'
        }
    }
);
