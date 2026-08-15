// Reglas de estilo y de corrección que aplican a TODO el repo.
// Formateo: este proyecto no usa Prettier (el porqué, en eslint.config.mjs).

import restrictedGlobals from 'confusing-browser-globals';
// @ts-expect-error Missing type definition
import importPlugin from 'eslint-plugin-import';
import stylistic from '@stylistic/eslint-plugin';

export default [
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
            // console.log no dice nada de para qué es el mensaje y no se puede
            // filtrar en el navegador: los niveles sí. Traza de desarrollo →
            // debug (el navegador la oculta por defecto), algo raro pero
            // recuperable → warn, fallo de verdad → error.
            'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error'] }],
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
    }
];
