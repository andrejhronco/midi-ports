import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/**'] },
  },
})
