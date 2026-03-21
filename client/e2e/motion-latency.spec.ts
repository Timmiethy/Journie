import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginToHome,
  pngBuffer,
  seedPersona,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 430, height: 932 },
});

test('primary capture and navigation actions respond within the motion budgets', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);

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
  const captureStart = Date.now();
  await libraryInput.setInputFiles({
    name: 'latency-moment.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });
  await expect(page.getByText(/^review$/i)).toBeVisible();
  expect(Date.now() - captureStart).toBeLessThanOrEqual(300);

  await page.getByTestId('moment-review-next-button').click();
  await expect(page.getByText(/how does this feel\?/i)).toBeVisible();
  await page.getByRole('button', { name: /^good$/i }).click();
  await page.getByPlaceholder("what's happening?").fill('Latency motion test moment.');
  await page.getByTestId('moment-save-button').click();
  await page.getByText(/^review$/i).waitFor({ state: 'hidden', timeout: 15000 });

  const startJournalingButton = page.getByTestId('home-start-journal-button');
  await expect(startJournalingButton).toBeVisible({ timeout: 15000 });
  const homeToTimelineStart = Date.now();
  await startJournalingButton.click();
  await page.waitForURL('**/timeline');
  expect(Date.now() - homeToTimelineStart).toBeLessThanOrEqual(300);

  const generateButton = page.getByRole('button', { name: /generate my journal/i });
  const timelineToJournalStart = Date.now();
  await generateButton.click();
  await page.waitForURL(/\/journal\/\d{4}-\d{2}-\d{2}$/);
  expect(Date.now() - timelineToJournalStart).toBeLessThanOrEqual(300);

  await Promise.race([
    page.getByText(/your journal is being written/i).waitFor({ state: 'visible', timeout: 45000 }),
    page.getByRole('button', { name: /confirm & save|edit/i }).first().waitFor({ state: 'visible', timeout: 45000 }),
  ]);

  const confirmButton = page.getByRole('button', { name: /confirm & save/i });
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }

  const filteredConsoleErrors = consoleErrors.filter(
    (message) => !message.includes('Failed to load resource: the server responded with a status of 404 (Not Found)'),
  );

  expect(filteredConsoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
