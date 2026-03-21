import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testFrontendUrl = process.env.TEST_FRONTEND_URL ?? 'http://127.0.0.1:5173';
const chromiumMediaUse = {
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
} as const;

export default defineConfig({
  outputDir: path.join(workspaceRoot, 'output', 'client-playwright'),
  fullyParallel: true,
  workers: 4,
  projects: [
    {
      name: 'mock-mobile-chromium',
      testDir: './e2e/mock',
      use: {
        ...devices['Pixel 7'],
        ...chromiumMediaUse,
      },
    },
    {
      name: 'mock-desktop-chromium',
      testDir: './e2e/mock',
      use: {
        ...devices['Desktop Chrome'],
        ...chromiumMediaUse,
      },
    },
    {
      name: 'mock-desktop-firefox',
      testDir: './e2e/mock',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'integration-chromium',
      testDir: './e2e/integration',
      use: {
        ...devices['Pixel 7'],
        ...chromiumMediaUse,
      },
    },
  ],
  use: {
    baseURL: testFrontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/dev-runner.mjs',
    url: testFrontendUrl,
    cwd: workspaceRoot,
    reuseExistingServer: true,
    timeout: 180000,
  },
});

