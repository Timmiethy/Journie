import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@playwright/test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testFrontendUrl = process.env.TEST_FRONTEND_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: testFrontendUrl,
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  webServer: {
    command: 'pnpm run dev',
    url: testFrontendUrl,
    cwd: workspaceRoot,
    reuseExistingServer: true,
    timeout: 180000,
  },
});
