import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginToHome,
  pngBuffer,
  seedPersona,
} from './helpers/app-flow.ts';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.resolve(testDirectory, '../test-results/validation/component-1');

test.use({
  viewport: { width: 430, height: 932 },
});

test('component 1 keeps moment capture on /home and closes cleanly on back navigation', async ({ page, request }) => {
  test.setTimeout(90000);
  fs.mkdirSync(screenshotDir, { recursive: true });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);
  await loginToHome(page, email, password);

  const libraryInput = page.getByTestId('home-library-input');
  const reviewOpenStart = Date.now();

  await libraryInput.setInputFiles({
    name: 'component1-a.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/^review$/i)).toBeVisible();
  expect(Date.now() - reviewOpenStart).toBeLessThanOrEqual(150);

  const morphCountsDuringOpen = await page.evaluate(() => {
    return new Promise<number[]>((resolve) => {
      const counts: number[] = [];
      let frame = 0;
      const sample = () => {
        counts.push(document.querySelectorAll('[data-testid="capture-morph"]').length);
        frame += 1;
        if (frame >= 12) {
          resolve(counts);
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });

  expect(morphCountsDuringOpen.every((count) => count === 1)).toBeTruthy();

  await page.screenshot({
    path: path.join(screenshotDir, 'home-modal-open.png'),
    fullPage: true,
  });

  await page.goBack();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/^review$/i)).toHaveCount(0);
  await expect(page.getByTestId('capture-morph')).toBeVisible();

  await libraryInput.setInputFiles({
    name: 'component1-b.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  await expect(page.getByText(/^review$/i)).toBeVisible();
  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByText(/how does this feel\?/i)).toBeVisible();
  await page.getByRole('button', { name: /^good$/i }).click();
  await page.getByPlaceholder("what's happening?").fill('Component 1 motion validation moment.');
  await page.getByRole('button', { name: /save moment/i }).click();
  await page.getByText(/^review$/i).waitFor({ state: 'hidden', timeout: 15000 });

  await expect(page.getByRole('button', { name: /start journaling/i })).toBeVisible({ timeout: 15000 });

  await page.screenshot({
    path: path.join(screenshotDir, 'home-modal-saved.png'),
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
