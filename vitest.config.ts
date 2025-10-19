import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    // Exclude E2E tests from Vitest (use Playwright for E2E)
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],

    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          compatibilityDate: '2025-06-28',
          compatibilityFlags: ['nodejs_compat'],
        },
      },
    },
    // NOTE: Coverage is currently not fully supported with Workers Vitest pool
    // V8 coverage requires node:inspector which is not available in workerd
    // Istanbul coverage is the recommended approach but requires additional setup
    // See: https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#coverage
    // For now, we rely on comprehensive manual testing and will revisit with Istanbul
  },
});
