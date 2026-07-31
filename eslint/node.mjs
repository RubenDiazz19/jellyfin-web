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
    },

    // Herramientas de línea de comandos (scripts/). Escribir por consola es lo
    // que hacen: sin `no-console` no habría forma de informar del progreso, y
    // en una pasada larga contra una API con cuota eso es justo lo que hace
    // falta ver.
    {
        files: [ 'scripts/**/*.ts' ],
        rules: {
            'no-console': 'off'
        }
    }
];
