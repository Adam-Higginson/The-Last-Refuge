import { defineConfig } from 'vite';

export default defineConfig({
    base: '/The-Last-Refuge/',
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        target: 'ES2022',
    },
    test: {
        coverage: {
            provider: 'v8',
            include: ['src/core/**/*.ts', 'src/systems/**/*.ts'],
            exclude: ['**/__tests__/**', 'src/main.ts'],
            thresholds: {
                // Core framework must be well-tested
                'src/core/**/*.ts': {
                    branches: 80,
                    functions: 80,
                    lines: 80,
                    statements: 80,
                },
            },
        },
    },
});
