// Lo que solo aplica a los ficheros con JSX.

import reactHooks from 'eslint-plugin-react-hooks';

import { FC_MESSAGE } from './messages.mjs';

export default [
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
    }
];
