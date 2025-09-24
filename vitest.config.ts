import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import path from 'path'

const ROOT_DIR = path.resolve(__dirname, './')

export default defineConfig({
  plugins: [react()],
  test: {
    // Load environment variables from .env.test
    env: loadEnv('test', process.cwd(), ''),
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.*',
        '.next/',
        'drizzle/',
      ],
    },
    pool: 'threads',
    projects: [
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['components/**/*.test.{ts,tsx}', 'tests/unit/**/*.spec.ts'],
          pool: 'threads',
        },
      },
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['app/api/**/*.test.ts', 'lib/services/**/*.test.ts'],
          pool: 'threads',
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': ROOT_DIR,
      '@/components': path.resolve(ROOT_DIR, 'components'),
      '@/lib': path.resolve(ROOT_DIR, 'lib'),
      '@/app': path.resolve(ROOT_DIR, 'app'),
      '@/tests': path.resolve(ROOT_DIR, 'tests'),
    },
  },
})
