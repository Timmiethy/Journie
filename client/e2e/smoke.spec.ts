import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginWithPassword,
  pngBuffer,
  validationDirectory,
} from './helpers/app-flow.ts';

test('journie motion flow renders and navigates without console errors', async ({ page }) => {
  test.setTimeout(90000);
  fs.mkdirSync(validationDirectory, { recursive: true });

  const consoleErrors: string[] = [];
  const apiFailures: Array<{ url: string; status: number }> = [];
  const resourceFailures: Array<{ url: string; status: number; resourceType: string }> = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push({ url: response.url(), status: response.status() });
    }

    if (!response.url().includes('/api/') && response.status() >= 400) {
      resourceFailures.push({
        url: response.url(),
        status: response.status(),
        resourceType: response.request().resourceType(),
      });
    }
  });

  const { email, password } = await createConfirmedUser(page.request);
  await loginWithPassword(page, email, password, '**/onboarding');

  const nextButton = page.getByRole('button', { name: /^next$/i });
  const continueOnboarding = async (optionName: RegExp, nextHeadingName: RegExp) => {
    await expect(page.getByRole('button', { name: optionName })).toBeVisible();
    await page.getByRole('button', { name: optionName }).click();
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    await expect(page.getByRole('heading', { name: nextHeadingName })).toBeVisible();
  };

  await expect(page.getByRole('heading', { name: /how should your journal sound\?/i })).toBeVisible();

  await page.screenshot({ path: path.join(validationDirectory, '01-onboarding.png'), fullPage: true });

  await continueOnboarding(/casual/i, /what matters to you\?/i);
  await continueOnboarding(/emotions/i, /how do you talk to yourself\?/i);
  await continueOnboarding(/first person/i, /how deep should we go\?/i);
  await continueOnboarding(/moderate/i, /pick what fits you/i);
  await page.getByRole('button', { name: /creative/i }).click();
  await page.getByRole('button', { name: /optimist/i }).click();
  await expect(nextButton).toBeEnabled();
  await nextButton.click();
  await expect(page.getByRole('heading', { name: /what's your mbti type\?/i })).toBeVisible();
  await continueOnboarding(/^intj$/i, /what do you do\?/i);
  await continueOnboarding(/^student$/i, /who's usually in your day\?/i);
  await continueOnboarding(/mostly solo/i, /what fills your days lately\?/i);
  await continueOnboarding(/work \/ school/i, /tell the ai anything else/i);
  await page.locator('textarea').fill('Motion validation user for the frontend flow.');
  await nextButton.click();
  await expect(page.getByRole('heading', { name: /this is how your journal will sound/i })).toBeVisible();
  await page.getByRole('button', { name: /looks good, let's go/i }).click();
  await page.waitForURL('**/home');

  await expect(page.getByText(/good/i)).toBeVisible();
  await page.screenshot({ path: path.join(validationDirectory, '02-home.png'), fullPage: true });

  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: 'moment.png', mimeType: 'image/png', buffer: pngBuffer });
  await expect(page.getByText(/^review$/i)).toBeVisible();
  await page.screenshot({ path: path.join(validationDirectory, '03-moment-review.png'), fullPage: true });

  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByText(/how does this feel\?/i)).toBeVisible();
  await page.getByRole('button', { name: /^good$/i }).click();
  await page.getByPlaceholder("what's happening?").fill('Coffee, code, and a deterministic motion test.');
  await page.screenshot({ path: path.join(validationDirectory, '04-moment-context.png'), fullPage: true });
  await page.getByRole('button', { name: /save moment/i }).click();

  const startJournalingButton = page.getByRole('button', { name: /start journaling/i });
  await expect(startJournalingButton).toBeVisible();
  await startJournalingButton.click();
  await page.waitForURL('**/timeline');
  await expect(page.getByRole('button', { name: /generate my journal/i })).toBeVisible();
  await page.screenshot({ path: path.join(validationDirectory, '05-timeline.png'), fullPage: true });

  const reorderResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/moments/reorder') &&
      response.request().method() === 'PATCH',
  );
  const generateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/journal/generate') &&
      response.request().method() === 'POST',
  );

  await page.getByRole('button', { name: /generate my journal/i }).click();
  const reorderResponse = await reorderResponsePromise;
  expect(reorderResponse.ok()).toBeTruthy();
  const generateResponse = await generateResponsePromise;
  expect([200, 202]).toContain(generateResponse.status());
  await page.waitForURL(/\/journal\/\d{4}-\d{2}-\d{2}$/);
  await page.waitForLoadState('networkidle');
  await Promise.race([
    page.getByText(/we're shaping today's journal/i).waitFor({ state: 'visible', timeout: 45000 }),
    page.getByRole('button', { name: /confirm & save/i }).waitFor({ state: 'visible', timeout: 45000 }),
    page.getByRole('button', { name: /edit/i }).waitFor({ state: 'visible', timeout: 45000 }),
  ]);
  await page.screenshot({ path: path.join(validationDirectory, '06-journal.png'), fullPage: true });

  const confirmButton = page.getByRole('button', { name: /confirm & save/i });
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }

  await page.goto('/journals');
  await expect(page.getByText(/archive/i)).toBeVisible();
  await expect(page.getByText(/recent/i)).toBeVisible();
  await page.screenshot({ path: path.join(validationDirectory, '07-history.png'), fullPage: true });

  await page.getByRole('button', { name: new RegExp(`${new Date().getDate()}`) }).first().click();
  await expect(page.getByText(/^day$/i).first()).toBeVisible();
  await page.screenshot({ path: path.join(validationDirectory, '08-history-popover.png'), fullPage: true });

  fs.writeFileSync(
    path.join(validationDirectory, 'smoke-console.json'),
    JSON.stringify({ consoleErrors, apiFailures, resourceFailures }, null, 2),
  );

  const filteredConsoleErrors = consoleErrors.filter(
    (message) => !message.includes('Failed to load resource: the server responded with a status of 404 (Not Found)'),
  );

  const filteredResourceFailures = resourceFailures.filter(
    (failure) =>
      !failure.url.endsWith('/favicon.svg') &&
      !failure.url.includes('.map'),
  );
  const filteredApiFailures = apiFailures.filter(
    (failure) =>
      !(
        failure.status === 404 &&
        /\/api\/journal\/\d{4}-\d{2}-\d{2}$/.test(failure.url)
      ),
  );

  expect(filteredConsoleErrors).toEqual([]);
  expect(filteredApiFailures).toEqual([]);
  expect(filteredResourceFailures).toEqual([]);
});
