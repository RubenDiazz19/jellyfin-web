// El JS heredado del cliente oficial, con las reglas de opinión relajadas,
// y el service worker, que corre en su propio ámbito global.

import globals from 'globals';

export default [
    // Service worker
    {
        files: [ 'src/serviceworker.js' ],
        languageOptions: {
            globals: {
                ...globals.serviceworker
            }
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
];
