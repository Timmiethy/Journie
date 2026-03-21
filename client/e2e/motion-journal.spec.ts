import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

async function createSeededUser(
  request: import('@playwright/test').APIRequestContext,
  suffix: string,
) {
  const { email, password, userId } = await createConfirmedUser(request);

  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const createPersonaResponse = await request.post(
    `${serverEnv.SUPABASE_URL}/rest/v1/personas`,
    {
      headers,
      data: {
        user_id: userId,
        writing_style: 'casual',
        journal_topics: ['events'],
        narrative_voice: 'first_person',
        emotional_depth: 'moderate',
        personality_tags: ['creative', 'optimist'],
        mbti: 'INTJ',
        occupation: 'student',
        daily_people: ['mostly-solo'],
        daily_activities: ['work-school'],
        additional_context: 'Journal validation seed persona.',
      },
    },
  );

  expect(createPersonaResponse.ok()).toBeTruthy();
  return { email, password, userId, headers };
}

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const screenshotDir = path.resolve(testDirectory, '../test-results/validation/component-3');
const pngDataUrl = `data:image/png;base64,${
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pRyxu8AAAAASUVORK5CYII='
}`;

test('journal generating state renders the quill loader without console errors', async ({ page, request }) => {
  test.setTimeout(120000);
  fs.mkdirSync(screenshotDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
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

  const { email, password, userId, headers } = await createSeededUser(request, 'generating');

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
  await expect(page.getByRole('img', { name: /journal writing animation/i })).toBeVisible();

  await page.screenshot({
    path: path.join(screenshotDir, 'journal-generating.png'),
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('journal direct entry exits safely back home instead of falling through history', async ({ page, request }) => {
  test.setTimeout(120000);

  const today = new Date().toISOString().slice(0, 10);
  const { email, password, userId, headers } = await createSeededUser(request, 'direct-exit');

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

  const today = new Date().toISOString().slice(0, 10);
  const { email, password, userId, headers } = await createSeededUser(request, 'history-exit');

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

  const today = new Date().toISOString().slice(0, 10);
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

  const { email, password, userId, headers } = await createSeededUser(request, 'draft');

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
