import { expect, test } from '@playwright/test';

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createMockSession() {
  const user = {
    id: 'mock-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mock-user@example.com',
    email_confirmed_at: '2026-03-22T12:00:00.000Z',
    phone: '',
    confirmed_at: '2026-03-22T12:00:00.000Z',
    last_sign_in_at: '2026-03-22T12:00:00.000Z',
    app_metadata: {
      provider: 'email',
      providers: ['email'],
    },
    user_metadata: {
      display_name: 'Mock User',
    },
    identities: [],
    created_at: '2026-03-22T12:00:00.000Z',
    updated_at: '2026-03-22T12:00:00.000Z',
  };

  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
  };
}

function createMoment(dayDate: string) {
  const timestamp = `${dayDate}T08:00:00.000Z`;

  return {
    id: 'moment-1',
    user_id: 'mock-user',
    day_date: dayDate,
    order_index: 0,
    text_context: 'Mock timeline moment.',
    voice_transcript: null,
    mood: 'good',
    captured_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    photos: [
      {
        id: 'photo-1',
        moment_id: 'moment-1',
        storage_path: 'moments/photo-1.jpg',
        photo_url: 'https://example.com/photo-1.jpg',
        order_index: 0,
        created_at: timestamp,
      },
    ],
  };
}

function createDraftJournal(dayDate: string, content: string, status: 'draft' | 'confirmed' = 'draft') {
  const timestamp = `${dayDate}T12:00:00.000Z`;

  return {
    id: `journal-${dayDate}`,
    user_id: 'mock-user',
    day_date: dayDate,
    content,
    generated_content: content,
    status,
    entry_type: 'daily',
    daily_achievement: 'Mock highlight',
    best_photo_url: 'https://example.com/photo-1.jpg',
    generated_at: timestamp,
    confirmed_at: status === 'confirmed' ? timestamp : null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

test.describe('mock critical flow', () => {
  test('logs in, restores home, generates a journal, and saves without backend dependencies', async ({ page }) => {
    const currentDay = todayIso();
    const session = createMockSession();
    const moment = createMoment(currentDay);
    let generatedMomentIds: string[] | null = null;
    let savedJournalContent = createDraftJournal(
      currentDay,
      'Mock journal content that stays stable through the save flow.',
    );

    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.route(/.*\/auth\/v1\/token\?grant_type=(password|refresh_token).*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      });
    });

    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      });
    });

    await page.route('**/api/persona', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'persona-1',
          user_id: 'mock-user',
          attention_filter: 'aesthetics',
          life_chapter: 'building',
          tone_preset: 'poetic',
          daily_people: ['mostly-solo'],
          additional_context: 'Mock persona',
          created_at: '2026-03-22T12:00:00.000Z',
          updated_at: '2026-03-22T12:00:00.000Z',
        }),
      });
    });

    await page.route(`**/api/moments?date=${currentDay}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([moment]),
      });
    });

    await page.route('**/api/moments/reorder', async (route) => {
      await route.fulfill({
        status: 204,
        body: '',
      });
    });

    await page.route('**/api/journal/generate', async (route) => {
      const payload = route.request().postDataJSON() as { momentIds?: string[] } | undefined;
      generatedMomentIds = payload?.momentIds ?? null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'generating' }),
      });
    });

    await page.route(`**/api/journal/${currentDay}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        const payload = route.request().postDataJSON() as { content: string };
        savedJournalContent = createDraftJournal(currentDay, payload.content, 'confirmed');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(savedJournalContent),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(savedJournalContent),
      });
    });

    await page.goto('/auth');
    await page.getByRole('button', { name: /already have an account\? log in/i }).click();
    await page.getByPlaceholder('email').fill('mock-user@example.com');
    await page.getByPlaceholder('password').fill('Test123456!');
    await page.getByRole('button', { name: /^log in$/i }).click();

    await page.waitForURL('**/home');
    await page.getByTestId('home-activity-handle').click();
    await expect(page.getByTestId('home-start-journal-button')).toBeVisible();
    await page.getByTestId('home-start-journal-button').click();

    await page.waitForURL('**/timeline');
    await page.getByRole('button', { name: /generate my journal/i }).click();

    await page.waitForURL(`**/journal/${currentDay}`);
    await expect(page.getByRole('button', { name: /confirm & save/i })).toBeVisible();
    await expect(page.getByText(/mock journal content that stays stable/i)).toBeVisible();
    expect(generatedMomentIds).toEqual(['moment-1']);

    await page.getByRole('button', { name: /confirm & save/i }).click();
    await page.waitForURL('**/home');
    await expect(page.getByRole('button', { name: /^journal$/i })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
