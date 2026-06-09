import js from '@eslint/js';

export default [
  {
    files: ['overlay/**/*.js', 'helm/**/*.js', 'playwright/**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        history: 'readonly',
        location: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
];
