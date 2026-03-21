import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from '@playwright/test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://127.0.0.1:5173',
    cwd: workspaceRoot,
    reuseExistingServer: true,
    timeout: 180000,
  },
});
