import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  browserTodayISO,
  createConfirmedUser,
  loginToHome,
  seedPersona,
  serverEnv,
  validationDirectory,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 430, height: 932 },
});

async function createSeededUser(
  request: import('@playwright/test').APIRequestContext,
) {
  const { email, password, userId } = await createConfirmedUser(request);

  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  await seedPersona(request, userId);

  return { email, password, userId, headers };
}
const screenshotDir = path.join(validationDirectory, 'component-3');
const pngDataUrl = `data:image/png;base64,${
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pRyxu8AAAAASUVORK5CYII='
}`;

function createJournalFixture(date: string, status: 'generating' | 'draft' | 'confirmed', content: string) {
  const timestamp = new Date().toISOString();

  return {
    id: `journal-${date}`,
    user_id: 'test-user',
    day_date: date,
    content,
    generated_content: status === 'generating' ? null : content,
    status,
    entry_type: 'daily',
    daily_achievement: null,
    best_photo_url: null,
    generated_at: timestamp,
    confirmed_at: status === 'confirmed' ? timestamp : null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function createJsonRouteResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

test('journal generating state renders the cursor loader without console errors', async ({ page, request }) => {
  test.setTimeout(120000);
  fs.mkdirSync(screenshotDir, { recursive: true });

  const today = await browserTodayISO(page);
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

  const { email, password, userId, headers } = await createSeededUser(request);

  await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/journal_entries`, {
    headers,
    data: {
      user_id: userId,
      day_date: today,
      content: '',
      status: 'generating',
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  await loginToHome(page, email, password);
  await page.goto(`/journal/${today}`);
  await expect(page.locator('[data-journal-skeleton="true"]')).toHaveCount(0);
  await expect(page.getByTestId('journal-generating-cursor')).toBeVisible();
  await expect(page.getByRole('button', { name: /edit/i })).toHaveCount(0);
  const firstMessage = await page.getByTestId('journal-generating-message').textContent();
  await expect
    .poll(async () => await page.getByTestId('journal-generating-message').textContent(), {
      timeout: 5000,
    })
    .not.toBe(firstMessage);
  const cursorOpacities = await page.evaluate(async () => {
    const cursor = document.querySelector<HTMLElement>('[data-testid="journal-generating-cursor"]');
    if (!cursor) {
      return [];
    }

    const samples: number[] = [];
    const startedAt = performance.now();

    return new Promise<number[]>((resolve) => {
      const sample = () => {
        samples.push(Number.parseFloat(window.getComputedStyle(cursor).opacity || '1'));
        if (performance.now() - startedAt >= 1600) {
          resolve(samples);
          return;
        }

        window.setTimeout(sample, 120);
      };

      sample();
    });
  });
  expect(cursorOpacities.length).toBeGreaterThan(4);
  expect(Math.max(...cursorOpacities) - Math.min(...cursorOpacities)).toBeGreaterThan(0.45);

  await page.screenshot({
    path: path.join(screenshotDir, 'journal-generating.png'),
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('generated journal confirms and returns home after save', async ({ page, request }) => {
  test.setTimeout(120000);

  const today = await browserTodayISO(page);
  const { email, password, userId } = await createSeededUser(request);

  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/moments`, {
    headers,
    data: {
      user_id: userId,
      day_date: today,
      order_index: 0,
      text_context: 'A generated journal should save and go home.',
      voice_transcript: null,
      mood: 'good',
      captured_at: new Date().toISOString(),
    },
  });

  let getCount = 0;
  await page.route(`**/api/journal/${today}`, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      getCount += 1;
      const payload = getCount <= 2
        ? createJournalFixture(today, 'generating', '')
        : createJournalFixture(today, 'draft', 'Generated journal copy that should remain visible.');
      await route.fulfill(createJsonRouteResponse(payload));
      return;
    }

    if (method === 'PATCH') {
      const body = route.request().postDataJSON() as { status: 'confirmed'; content: string };
      await route.fulfill(createJsonRouteResponse(createJournalFixture(today, body.status, body.content)));
      return;
    }

    await route.fallback();
  });

  await loginToHome(page, email, password);
  await page.goto(`/journal/${today}`);

  await expect(page.getByText(/generated journal copy that should remain visible\./i)).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: /confirm & save/i }).click();
  await page.waitForURL('**/home');
});

test('journal generation recovers from transient polling errors without showing the terminal failure state', async ({ page, request }) => {
  test.setTimeout(120000);

  const today = await browserTodayISO(page);
  const { email, password } = await createSeededUser(request);

  let getCount = 0;
  await page.route(`**/api/journal/${today}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    getCount += 1;

    if (getCount === 1 || getCount === 4) {
      await route.fulfill(createJsonRouteResponse(createJournalFixture(today, 'generating', '')));
      return;
    }

    if (getCount === 2 || getCount === 3) {
      await route.fulfill(createJsonRouteResponse({ error: 'Temporary upstream issue' }, 500));
      return;
    }

    await route.fulfill(createJsonRouteResponse(
      createJournalFixture(today, 'draft', 'Recovered after transient polling failures.'),
    ));
  });

  await loginToHome(page, email, password);
  await page.goto(`/journal/${today}`);

  await expect(page.getByText(/recovered after transient polling failures\./i)).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText('Something went wrong.')).toHaveCount(0);
});

test('journal generation keeps polling when a terminal draft arrives without usable content', async ({ page, request }) => {
  test.setTimeout(120000);

  const today = await browserTodayISO(page);
  const { email, password } = await createSeededUser(request);

  let getCount = 0;
  await page.route(`**/api/journal/${today}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    getCount += 1;

    if (getCount === 1) {
      await route.fulfill(createJsonRouteResponse(createJournalFixture(today, 'generating', '')));
      return;
    }

    if (getCount === 2 || getCount === 3) {
      await route.fulfill(createJsonRouteResponse(createJournalFixture(today, 'draft', '')));
      return;
    }

    await route.fulfill(createJsonRouteResponse(
      createJournalFixture(today, 'draft', 'Final generated journal content remains intact.'),
    ));
  });

  await loginToHome(page, email, password);
  await page.goto(`/journal/${today}`);

  await expect(page.getByText(/final generated journal content remains intact\./i)).toBeVisible({
    timeout: 20000,
  });
});

test('journal generation shows the retry state when explicit failure content arrives', async ({ page, request }) => {
  test.setTimeout(120000);

  const today = await browserTodayISO(page);
  const { email, password } = await createSeededUser(request);

  let getCount = 0;
  await page.route(`**/api/journal/${today}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    getCount += 1;

    if (getCount === 1) {
      await route.fulfill(createJsonRouteResponse(createJournalFixture(today, 'generating', '')));
      return;
    }

    await route.fulfill(createJsonRouteResponse(
      createJournalFixture(
        today,
        'draft',
        'Generation failed — tap Regenerate to try again.',
      ),
    ));
  });

  await loginToHome(page, email, password);
  await page.goto(`/journal/${today}`);

  await expect(page.getByText('Something went wrong.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: /try again/i })).toBeVisible({ timeout: 15000 });
});

test('journal direct entry exits safely back home instead of falling through history', async ({ page, request }) => {
  test.setTimeout(120000);

  const today = await browserTodayISO(page);
  const { email, password, userId, headers } = await createSeededUser(request);

  const createJournalResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/journal_entries`, {
    headers,
    data: {
      user_id: userId,
      day_date: today,
      content: 'Direct-entry journal route validation.',
      status: 'confirmed',
      generated_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  expect(createJournalResponse.ok()).toBeTruthy();

  await loginToHome(page, email, password);
  await page.goto(`/journal/${today}`);

  await page.getByRole('button', { name: /^home$/i }).click();
  await page.waitForURL('**/home');
});

test('history-opened journal returns to archive with an explicit exit', async ({ page, request }) => {
  test.setTimeout(120000);

  const today = await browserTodayISO(page);
  const { email, password, userId, headers } = await createSeededUser(request);

  const createJournalResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/journal_entries`, {
    headers,
    data: {
      user_id: userId,
      day_date: today,
      content: 'History exit validation journal.',
      status: 'confirmed',
      generated_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  expect(createJournalResponse.ok()).toBeTruthy();

  await loginToHome(page, email, password);
  await page.goto('/journals');
  await page.getByRole('button', { name: /history exit validation journal/i }).click();
  await page.waitForURL(new RegExp(`/journal/${today}$`));

  await page.getByRole('button', { name: /^archive$/i }).first().click();
  await page.waitForURL('**/journals');
});

test('journal draft state renders semantic markdown blocks', async ({ page, request }) => {
  test.setTimeout(120000);
  fs.mkdirSync(screenshotDir, { recursive: true });

  const today = await browserTodayISO(page);
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

  const { email, password, userId, headers } = await createSeededUser(request);

  const createMomentResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/moments`, {
    headers,
    data: {
      user_id: userId,
      day_date: today,
      order_index: 0,
      text_context: 'Seeded journal moment',
      voice_transcript: null,
      mood: 'good',
      captured_at: new Date().toISOString(),
    },
  });

  expect(createMomentResponse.ok()).toBeTruthy();
  const createdMoment = (await createMomentResponse.json()) as Array<{ id: string }>;

  const createPhotoResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/moment_photos`, {
    headers,
    data: {
      moment_id: createdMoment[0].id,
      storage_path: `inline/${createdMoment[0].id}.png`,
      photo_url: pngDataUrl,
      order_index: 0,
      created_at: new Date().toISOString(),
    },
  });

  expect(createPhotoResponse.ok()).toBeTruthy();

  const draftContent = [
    '# Morning Note',
    '',
    'The day started quietly, but it still felt worth keeping.',
    '',
    '- first detail',
    '- second detail',
    '',
    'A short closing reflection to end the entry.',
  ].join('\n');

  const createJournalResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/journal_entries`, {
    headers,
    data: {
      user_id: userId,
      day_date: today,
      content: draftContent,
      status: 'draft',
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  expect(createJournalResponse.ok()).toBeTruthy();

  await loginToHome(page, email, password);
  await page.goto(`/journal/${today}`);

  await expect(page.getByRole('heading', { name: /morning note/i })).toBeVisible();
  await expect(page.locator('li')).toHaveCount(2);
  await expect(page.locator('p')).not.toHaveCount(0);

  await page.screenshot({
    path: path.join(screenshotDir, 'journal-draft.png'),
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});




