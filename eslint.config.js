import js from '@eslint/js';

const browserGlobals = {
  Blob: 'readonly',
  URL: 'readonly',
  document: 'readonly',
  structuredClone: 'readonly',
  window: 'readonly'
};

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  structuredClone: 'readonly'
};

const testGlobals = {
  ...nodeGlobals,
  URL: 'readonly'
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: browserGlobals
    }
  },
  {
    files: ['scripts/**/*.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: nodeGlobals
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: testGlobals
    }
  }
];
