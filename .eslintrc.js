module.exports = {
  root: true,
  extends: ['next', 'next/core-web-vitals', 'next/typescript'],
  plugins: ['@next/next'],
  ignorePatterns: ['**/*.js', '**/*.cjs', '**/*.mjs', '.next/**', 'node_modules/**'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
        '@typescript-eslint/ban-ts-comment': [
          'warn',
          { 'ts-expect-error': 'allow-with-description' },
        ],
        'prefer-const': ['warn', { destructuring: 'all' }],
      },
    },
    {
      files: ['**/*.tsx'],
      rules: {
        'react/no-unescaped-entities': 'off',
        '@next/next/no-img-element': 'off',
        'react-hooks/exhaustive-deps': 'off',
      },
    },
    {
      files: [
        'components/workspace/agent-view/**/*.tsx',
        'components/desktop/**/*.tsx',
        'components/rag-chat/**/*.tsx',
        'app/hazmat-chat/**/*.tsx',
        'app/hazmat-chatworld/**/*.tsx',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['scripts/**/*.ts', 'scripts/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
