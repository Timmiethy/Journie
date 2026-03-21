import fs from 'node:fs';
import path from 'node:path';
import { addMinutes, format } from 'date-fns';
import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginToHome,
  seedPersona,
  serverEnv,
  validationDirectory,
} from './helpers/app-flow.ts';

test('component 2 timeline keeps reorder local until explicit completion', async ({ page, request }) => {
  test.setTimeout(120000);

  const { email, password, userId } = await createConfirmedUser(request);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let reorderRequests = 0;
  let generatedMomentIds: string[] | null = null;
  const today = new Date();
  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  fs.mkdirSync(validationDirectory, { recursive: true });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });
  page.on('request', (requestEvent) => {
    if (requestEvent.method() === 'PATCH' && requestEvent.url().includes('/api/moments/reorder')) {
      reorderRequests += 1;
    }
  });

  await seedPersona(request, userId);

  const journalDate = format(today, 'yyyy-MM-dd');
  await page.route('**/api/journal/generate', async (route) => {
    const payload = route.request().postDataJSON() as { momentIds?: string[] } | undefined;
    generatedMomentIds = payload?.momentIds ?? null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'generating' }),
    });
  });
  await page.route(`**/api/journal/${journalDate}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'stub-journal',
        user_id: userId,
        day_date: journalDate,
        content: 'Stub journal for timeline validation.',
        status: 'draft',
        generated_at: new Date().toISOString(),
        confirmed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  });

  for (let index = 0; index < 6; index += 1) {
    const createMomentResponse = await request.post(
      `${serverEnv.SUPABASE_URL}/rest/v1/moments`,
      {
        headers,
        data: {
          user_id: userId,
          day_date: journalDate,
          order_index: index,
          text_context: `Moment ${index + 1}`,
          voice_transcript: null,
          mood: null,
          captured_at: addMinutes(today, index).toISOString(),
        },
      },
    );

    expect(createMomentResponse.ok()).toBeTruthy();
  }

  await loginToHome(page, email, password);
  await page.getByTestId('home-activity-handle').click();
  await expect(page.getByTestId('home-activity-sheet')).toHaveAttribute('data-sheet-state', 'peek');
  await page.getByRole('button', { name: /start journal/i }).click();
  await page.waitForURL('**/timeline');

  const handles = page.getByLabel(/reorder moment/i);
  await expect(handles).toHaveCount(6);
  await expect(page.locator('[data-window-hidden="true"]')).toHaveCount(1);

  const firstHandleBox = await handles.nth(0).boundingBox();
  const secondHandleBox = await handles.nth(1).boundingBox();

  if (!firstHandleBox || !secondHandleBox) {
    throw new Error('Timeline drag handles are not measurable.');
  }

  await page.mouse.move(
    firstHandleBox.x + firstHandleBox.width / 2,
    firstHandleBox.y + firstHandleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    secondHandleBox.x + secondHandleBox.width / 2,
    secondHandleBox.y + secondHandleBox.height / 2 + 32,
    { steps: 10 },
  );
  await page.mouse.up();

  expect(reorderRequests).toBe(0);

  await page.screenshot({
    path: path.join(validationDirectory, 'component2-timeline.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: /done — generate my journal/i }).click();
  await expect.poll(() => reorderRequests, { timeout: 10000 }).toBe(1);
  expect(generatedMomentIds).not.toBeNull();
  expect(generatedMomentIds).toHaveLength(6);

  fs.writeFileSync(
    path.join(validationDirectory, 'component2-console.json'),
    JSON.stringify({ consoleErrors, pageErrors, reorderRequests }, null, 2),
  );

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
