// Configuraciones recomendadas de cada plugin, sobre las que el resto de
// módulos ajusta. El orden importa: lo que viene después gana.

import eslint from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import compat from 'eslint-plugin-compat';
// @ts-expect-error Missing type definition
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import sonarjs from 'eslint-plugin-sonarjs';
// eslint-disable-next-line import/no-unresolved
import tseslint from 'typescript-eslint';

export default [
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
    jsxA11y.flatConfigs.recommended
];
