import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Load environment variables from .env.test
    env: loadEnv('test', process.cwd(), ''),
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    environmentMatchGlobs: [
      // Use node environment for API route tests
      ['app/api/**/*.test.ts', 'node'],
      ['lib/services/**/*.test.ts', 'node'],
      // Use jsdom for component tests
      ['components/**/*.test.tsx', 'jsdom'],
    ],
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/app': path.resolve(__dirname, './app'),
    },
  },
})