import fs from 'node:fs';
import path from 'node:path';
import { addDays, endOfWeek, format, subDays } from 'date-fns';
import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginToHome,
  seedPersona,
  serverEnv,
  validationDirectory,
} from './helpers/app-flow.ts';

test('component 5 calendar renders streaks and a single root popover safely at the viewport edge', async ({ page, request }) => {
  test.setTimeout(120000);

  const { email, password, userId } = await createConfirmedUser(request);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const sunday = endOfWeek(new Date(), { weekStartsOn: 1 });
  const saturday = subDays(sunday, 1);
  const friday = subDays(sunday, 2);
  const streakDates = [friday, saturday, sunday];

  fs.mkdirSync(validationDirectory, { recursive: true });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  await seedPersona(request, userId);

  for (const [index, date] of streakDates.entries()) {
    const dayDate = format(date, 'yyyy-MM-dd');
    const createJournalResponse = await request.post(
      `${serverEnv.SUPABASE_URL}/rest/v1/journal_entries`,
      {
        headers,
        data: {
          user_id: userId,
          day_date: dayDate,
          content: `Seeded journal ${index + 1}\n\nA confirmed entry for ${dayDate}.`,
          status: 'confirmed',
          generated_at: addDays(date, 0).toISOString(),
          confirmed_at: addDays(date, 0).toISOString(),
          updated_at: addDays(date, 0).toISOString(),
        },
      },
    );

    expect(createJournalResponse.ok()).toBeTruthy();
  }

  await loginToHome(page, email, password);
  await page.goto('/journals');

  await expect(page.locator('[data-streak-segment="true"]')).toHaveCount(1);

  const edgeDate = format(sunday, 'yyyy-MM-dd');
  const middleDate = format(saturday, 'yyyy-MM-dd');
  const edgeDay = page.locator(`[data-calendar-day="${edgeDate}"]`);
  const middleDay = page.locator(`[data-calendar-day="${middleDate}"]`);
  await expect(edgeDay).toBeVisible();
  await edgeDay.click();

  const popover = page.locator('[data-calendar-popover="true"]');
  await expect(popover).toHaveCount(1);
  await expect(popover).toContainText(format(sunday, 'EEEE, MMMM d'));

  const popoverMetrics = await popover.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
    };
  });

  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('Viewport size is unavailable.');
  }

  expect(popoverMetrics.left).toBeGreaterThanOrEqual(0);
  expect(popoverMetrics.right).toBeLessThanOrEqual(viewport.width);
  expect(popoverMetrics.top).toBeGreaterThanOrEqual(0);
  expect(popoverMetrics.bottom).toBeLessThanOrEqual(viewport.height);

  const retargetCountsPromise = page.evaluate(() => {
    return new Promise<number[]>((resolve) => {
      const counts: number[] = [];
      let frame = 0;

      const sample = () => {
        counts.push(document.querySelectorAll('[data-calendar-popover="true"]').length);
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

  await middleDay.click();
  const retargetCounts = await retargetCountsPromise;

  expect(retargetCounts.every((count) => count === 1)).toBeTruthy();
  await expect(popover).toHaveCount(1);
  await expect(popover).toContainText(format(saturday, 'EEEE, MMMM d'));

  await middleDay.click();
  await expect(popover).toHaveCount(0);

  await edgeDay.click();
  await expect(popover).toContainText(format(sunday, 'EEEE, MMMM d'));

  await page.screenshot({
    path: path.join(validationDirectory, 'component5-calendar.png'),
    fullPage: true,
  });

  const historyToJournalStart = Date.now();
  await popover.getByRole('button', { name: /open journal/i }).click();
  await page.waitForURL(new RegExp(`/journal/${edgeDate}$`));
  expect(Date.now() - historyToJournalStart).toBeLessThanOrEqual(350);

  fs.writeFileSync(
    path.join(validationDirectory, 'component5-console.json'),
    JSON.stringify({ consoleErrors, pageErrors }, null, 2),
  );

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
