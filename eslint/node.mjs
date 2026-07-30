// Los ficheros de configuración del repo (fuera de src/): globales de node y
// commonjs por defecto.

import globals from 'globals';

export default [
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
    }
];
