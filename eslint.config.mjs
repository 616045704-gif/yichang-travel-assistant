import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', '.local-tools/**', '.local/**', 'coverage/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,mjs}'],
    languageOptions: { globals: { App: 'readonly', Page: 'readonly', Component: 'readonly', wx: 'readonly', console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly' } },
  },
);
