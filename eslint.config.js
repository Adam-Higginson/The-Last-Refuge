import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.strict,
    {
        rules: {
            // No any — enforced by the linter, not just convention
            '@typescript-eslint/no-explicit-any': 'error',

            // Named exports only
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ExportDefaultDeclaration',
                    message: 'Use named exports instead of default exports.',
                },
            ],

            // No unused vars (underscore prefix allowed for intentionally unused)
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],

            // Explicit return types on functions
            '@typescript-eslint/explicit-function-return-type': [
                'warn',
                { allowExpressions: true },
            ],
        },
    },
    {
        // Relaxed rules for test files
        files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },
    {
        ignores: ['dist/', 'node_modules/', '*.config.*'],
    },
);
