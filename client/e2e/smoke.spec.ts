import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

function readEnvFile(filePath: string): Record<string, string> {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.trim().startsWith('#'))
    .reduce<Record<string, string>>((acc, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverEnv = readEnvFile(path.resolve(testDirectory, '../../server/.env'));
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pRyxu8AAAAASUVORK5CYII=',
  'base64',
);

test('journie smoke flow renders and navigates core pages', async ({ page }) => {
  const email = `codex-smoke-${Date.now()}@example.com`;
  const password = 'Test123456!';

  const createUserResponse = await page.request.post(
    `${serverEnv.SUPABASE_URL}/auth/v1/admin/users`,
    {
      headers: {
        apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      data: {
        email,
        password,
        email_confirm: true,
      },
    },
  );

  expect(createUserResponse.ok()).toBeTruthy();

  await page.goto('/auth');
  await page.getByRole('button', { name: /already have an account\? log in/i }).click();
  await page.getByPlaceholder('email').fill(email);
  await page.getByPlaceholder('password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL('**/onboarding');

  await page.getByRole('button', { name: /casual/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /emotions/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /first person/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /moderate/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /creative/i }).click();
  await page.getByRole('button', { name: /optimist/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /^intj$/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /^student$/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /mostly solo/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /work \/ school/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.locator('textarea').fill('Smoke test user for full frontend navigation.');
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /looks good, let's go/i }).click();
  await page.waitForURL('**/home');
  await expect(page.getByText(/good/i)).toBeVisible();

  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: 'moment.png', mimeType: 'image/png', buffer: pngBuffer });
  await page.waitForURL('**/moments/new');

  await page.getByRole('button', { name: /^next$/i }).click();
  await page.getByRole('button', { name: /^good$/i }).click();
  await page.getByPlaceholder("what's happening?").fill('Coffee, code, and a passing smoke test.');
  await page.getByRole('button', { name: /save moment/i }).click();
  await page.waitForURL('**/home');

  await page.getByRole('button', { name: /start journaling/i }).click();
  await page.waitForURL('**/timeline');

  await page.getByRole('button', { name: /generate my journal/i }).click();
  await page.waitForURL(/\/journal\/\d{4}-\d{2}-\d{2}\/generate$/);
  await page.waitForURL(/\/journal\/\d{4}-\d{2}-\d{2}$/);

  await page.getByRole('button', { name: /looks good, save it/i }).click();
  await page.goto('/journals');
  await expect(page).toHaveURL(/\/journals$/);
  await expect(page.getByText(/archive/i)).toBeVisible();
  await expect(page.getByText(/recent/i)).toBeVisible();
});
