import { expect, test, type Page } from '@playwright/test';
import {
  createConfirmedUser,
  loginToHome,
  seedPersona,
  serverEnv,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 430, height: 932 },
});

async function openPeekSheet(page: Page) {
  await page.getByTestId('home-activity-handle').click();
  await expect(page.getByTestId('home-activity-sheet')).toHaveAttribute('data-sheet-state', 'peek');
}

test('home overflow row keeps later moments reachable without native scrollbars', async ({ page, request }) => {
  test.setTimeout(120000);

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);

  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const dayDate = new Date().toISOString().slice(0, 10);

  for (let index = 0; index < 5; index += 1) {
    const capturedAt = new Date(Date.now() + index * 60_000).toISOString();
    const createMomentResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/moments`, {
      headers,
      data: {
        user_id: userId,
        day_date: dayDate,
        order_index: index,
        text_context: `Overflow validation moment ${index + 1}`,
        voice_transcript: null,
        mood: 'good',
        captured_at: capturedAt,
      },
    });

    expect(createMomentResponse.ok()).toBeTruthy();
    const createdMoment = (await createMomentResponse.json()) as Array<{ id: string }>;

    const createPhotoResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/moment_photos`, {
      headers,
      data: {
        moment_id: createdMoment[0].id,
        storage_path: `overflow/${createdMoment[0].id}.png`,
        photo_url: `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pRyxu8AAAAASUVORK5CYII='}`,
        order_index: 0,
        created_at: capturedAt,
      },
    });

    expect(createPhotoResponse.ok()).toBeTruthy();
  }

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
