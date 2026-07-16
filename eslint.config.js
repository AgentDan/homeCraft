import eslint from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: ['**/node_modules/**', '**/.expo/**', 'apps/client/dist/**', 'packages/**/dist/**']
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    plugins: { react },
    settings: { react: { version: '19.0' } },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.object.name="JSON"][callee.property.name="parse"] > CallExpression[callee.object.name="JSON"][callee.property.name="stringify"]',
          message: 'Use structuredClone() instead of JSON.parse(JSON.stringify(...)).'
        }
      ],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
];
