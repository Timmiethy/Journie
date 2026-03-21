import { subMonths, format } from 'date-fns';
import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginToHome,
  seedPersona,
  serverEnv,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 430, height: 932 },
});

test('archive fetches accurate journal markers across older months', async ({ page, request }) => {
  test.setTimeout(120000);

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);

  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const baseDate = new Date();
  const targetDates = [0, 1, 2].map((offset) =>
    format(subMonths(new Date(baseDate.getFullYear(), baseDate.getMonth(), 12), offset), 'yyyy-MM-dd'),
  );

  for (const [index, dayDate] of targetDates.entries()) {
    const response = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/journal_entries`, {
      headers,
      data: {
        user_id: userId,
        day_date: dayDate,
        content: `Range validation journal ${index + 1}`,
        status: 'confirmed',
        generated_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    expect(response.ok()).toBeTruthy();
  }

  await loginToHome(page, email, password);
  await page.goto('/journals');

  await expect(page.getByText(/^monthly archive$/i)).toHaveCount(0);
  await expect(page.getByText(/the most recent confirmed days you can reopen immediately\./i)).toHaveCount(0);
  await expect(page.locator(`[data-calendar-day="${targetDates[0]}"]`)).toBeVisible();

  await page.getByRole('button', { name: /^previous month$/i }).click();
  await expect(page.locator(`[data-calendar-day="${targetDates[1]}"]`)).toBeVisible();
  await page.locator(`[data-calendar-day="${targetDates[1]}"]`).click();
  await expect(page.locator('[data-calendar-popover="true"]')).toContainText('Range validation journal 2');

  await page.getByRole('button', { name: /^previous month$/i }).click();
  await expect(page.locator(`[data-calendar-day="${targetDates[2]}"]`)).toBeVisible();
  await page.locator(`[data-calendar-day="${targetDates[2]}"]`).click();
  await expect(page.locator('[data-calendar-popover="true"]')).toContainText('Range validation journal 3');
});
