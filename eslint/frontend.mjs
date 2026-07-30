// El frontend propio (src/apps/frontend): fronteras MVVM y las relajaciones
// de estilo que se permite por ser una app de prototipado rápido.

import { FC_MESSAGE } from './messages.mjs';

export default [
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
            // `no-explicit-any` estaba apagado aquí (prototipado rápido) y era
            // el único sitio del repo con `any` explícitos: 20, todos ya
            // sustituidos por tipos concretos. Se deja como warning —no error—
            // para no frenar un prototipo, pero que se vea al escribirlo.
            '@typescript-eslint/no-explicit-any': 'warn',
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
    }
];
