import js from '@eslint/js';

export default [
  {
    files: ['helm/**/*.js', 'playwright/**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        history: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        // Service worker (sw.js) globals
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        Promise: 'readonly',
      },
    },
  },
];
