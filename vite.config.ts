import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
    base: command === 'build' ? '/The-Last-Refuge/' : '/',
    root: '.',
    publicDir: 'public',
    define: {
        __BUILD_TIME__: JSON.stringify(
            new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        ),
        __EXTIRIS_API_KEY__: JSON.stringify(process.env.VITE_EXTIRIS_API_KEY ?? ''),
    },
    server: {
        host: '0.0.0.0',
    },
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
}));
