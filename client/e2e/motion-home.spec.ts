import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginToHome,
  pngBuffer,
  seedPersona,
  validationDirectory,
} from './helpers/app-flow.ts';

const screenshotDir = path.join(validationDirectory, 'component-1');

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

  await expect(page.getByRole('button', { name: /^journal$/i })).toBeVisible();
  await expect(page.getByText(/good (morning|afternoon|evening)/i)).toHaveCount(0);
  await expect(page.getByText(/keep snapping until the day feels complete/i)).toHaveCount(0);

  const libraryInput = page.getByTestId('home-library-input');
  const reviewOpenStart = Date.now();

  await libraryInput.setInputFiles({
    name: 'component1-a.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/^review$/i)).toBeVisible();
  expect(Date.now() - reviewOpenStart).toBeLessThanOrEqual(1000);

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

  await page.getByRole('button', { name: /remove photo 1/i }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/^review$/i)).toHaveCount(0);
  await expect(page.getByTestId('capture-morph')).toBeVisible();

  await libraryInput.setInputFiles({
    name: 'component1-reopen.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  await expect(page.getByText(/^review$/i)).toBeVisible();
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
  const reviewNextStyles = await page.getByTestId('moment-review-next-button').evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderTopWidth: styles.borderTopWidth,
    };
  });
  expect(reviewNextStyles.borderTopWidth).toBe('0px');
  expect(reviewNextStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

  await page.getByTestId('moment-review-next-button').click();
  await expect(page.getByText(/how does this feel\?/i)).toBeVisible();
  const contextTextareaStyles = await page.getByTestId('moment-context-textarea').evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      borderTopWidth: styles.borderTopWidth,
      fontFamily: styles.fontFamily,
    };
  });
  expect(contextTextareaStyles.borderTopWidth).toBe('0px');
  expect(contextTextareaStyles.fontFamily).toMatch(/Lora|serif/i);

  await page.getByRole('button', { name: /^good$/i }).click();
  await page.getByTestId('moment-context-textarea').fill('Component 1 motion validation moment.');
  const saveMomentStyles = await page.getByTestId('moment-save-button').evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderTopWidth: styles.borderTopWidth,
    };
  });
  expect(saveMomentStyles.borderTopWidth).toBe('0px');
  expect(saveMomentStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

  await page.getByTestId('moment-save-button').click();
  await page.getByText(/^review$/i).waitFor({ state: 'hidden', timeout: 15000 });

  await expect(page.getByTestId('home-start-journal-button')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('home-activity-sheet')).toHaveAttribute('data-sheet-state', 'peek');

  await page.screenshot({
    path: path.join(screenshotDir, 'home-modal-saved.png'),
    fullPage: true,
  });
  await expect(page.getByTestId('home-start-journal-button')).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
