import { expect, test, type Page } from '@playwright/test';
import {
  browserTodayISO,
  createConfirmedUser,
  loginToHome,
  seedPersona,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 430, height: 932 },
});

async function openPeekSheet(page: Page) {
  await page.getByTestId('home-activity-handle').click();
  await expect(page.getByTestId('home-activity-sheet')).toHaveAttribute('data-sheet-state', 'peek');
  await expect
    .poll(async () => await page.getByTestId('today-moment-card').count())
    .toBeGreaterThan(0);
}

test('home overflow row keeps later moments reachable without native scrollbars', async ({ page, request }) => {
  test.setTimeout(120000);

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);
  const dayDate = await browserTodayISO(page);
  const mockedMoments = Array.from({ length: 5 }, (_, index) => {
    const capturedAt = new Date(Date.now() + index * 60_000).toISOString();
    const momentId = `overflow-moment-${index + 1}`;

    return {
      id: momentId,
      user_id: userId,
      day_date: dayDate,
      order_index: index,
      text_context: `Overflow validation moment ${index + 1}`,
      voice_transcript: null,
      mood: 'good',
      captured_at: capturedAt,
      photos: [
        {
          id: `overflow-photo-${index + 1}`,
          moment_id: momentId,
          storage_path: `overflow/${momentId}.png`,
          photo_url: `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pRyxu8AAAAASUVORK5CYII='}`,
          order_index: 0,
          created_at: capturedAt,
        },
      ],
    };
  });

  await page.route('**/api/moments?date=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockedMoments),
    });
  });

  await loginToHome(page, email, password);

  await openPeekSheet(page);
  await expect(page.getByTestId('today-moment-card')).toHaveCount(5);
  const momentStrip = page.getByLabel('today moments', { exact: true });
  const scrollRightButton = page.getByRole('button', { name: /scroll today moments right/i });

  await expect(scrollRightButton).toBeVisible();

  const scrollBefore = await momentStrip.evaluate((node) => node.scrollLeft);
  await scrollRightButton.click();
  await expect.poll(async () => momentStrip.evaluate((node) => node.scrollLeft)).toBeGreaterThan(scrollBefore);
});
