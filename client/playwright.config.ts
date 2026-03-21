import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@playwright/test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testBackendUrl = process.env.TEST_BACKEND_URL ?? 'http://127.0.0.1:3102';
const testFrontendUrl = process.env.TEST_FRONTEND_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: testFrontendUrl,
  },
  webServer: [
    {
      command: `PORT=3102 HOST=127.0.0.1 pnpm --filter server start:dev`,
      url: `${testBackendUrl}/api/health`,
      cwd: workspaceRoot,
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: `VITE_API_URL=${testBackendUrl}/api pnpm --filter client exec vite --host 127.0.0.1 --port 4173`,
      url: testFrontendUrl,
      cwd: workspaceRoot,
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
