import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { format } from 'date-fns';

function readEnvFile(filePath: string): Record<string, string> {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.trim().startsWith('#'))
    .reduce<Record<string, string>>((acc, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
export const serverEnv = readEnvFile(path.resolve(helperDirectory, '../../../server/.env'));
export const validationDirectory = path.resolve(helperDirectory, '../../../tasks/validation');
export const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pRyxu8AAAAASUVORK5CYII=',
  'base64',
);

export async function createConfirmedUser(request: APIRequestContext) {
  const email = `codex-motion-${Date.now()}@example.com`;
  const password = 'Test123456!';

  const createUserResponse = await request.post(
    `${serverEnv.SUPABASE_URL}/auth/v1/admin/users`,
    {
      headers: {
        apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      data: {
        email,
        password,
        email_confirm: true,
      },
    },
  );

  expect(createUserResponse.ok()).toBeTruthy();
  const createUserJson = await createUserResponse.json();
  const userId = (createUserJson.user?.id ?? createUserJson.id ?? createUserJson.user_id) as string | undefined;
  expect(userId).toBeTruthy();
  await waitForPasswordGrantReady(request, email, password);

  return { email, password, userId: userId as string };
}

export async function waitForPasswordGrantReady(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  let lastError = 'unknown auth readiness error';

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request.post(
      `${serverEnv.SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        headers: {
          apikey: serverEnv.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${serverEnv.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        data: {
          email,
          password,
        },
      },
    );

    if (response.ok()) {
      return;
    }

    lastError = await response.text();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for auth readiness for ${email}: ${lastError}`);
}

export async function gotoWithRetry(page: Page, url: string, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(url);
      return;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('ERR_CONNECTION_REFUSED') || attempt === attempts - 1) {
        throw error;
      }

      await page.waitForTimeout(1000);
    }
  }
}

export async function loginWithPassword(
  page: Page,
  email: string,
  password: string,
  destination = '**/home',
) {
  await gotoWithRetry(page, '/auth');
  await page.getByRole('button', { name: /already have an account\? log in/i }).click();
  await page.getByPlaceholder('email').fill(email);
  await page.getByPlaceholder('password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL(destination, { timeout: 60000 });
}

export async function loginToHome(page: Page, email: string, password: string) {
  await loginWithPassword(page, email, password, '**/home');
}

export async function seedPersona(request: APIRequestContext, userId: string) {
  const response = await request.post(
    `${serverEnv.SUPABASE_URL}/rest/v1/personas`,
    {
      headers: {
        apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: {
        user_id: userId,
        writing_style: 'casual',
        journal_topics: ['emotions'],
        narrative_voice: 'first_person',
        emotional_depth: 'moderate',
        personality_tags: ['creative', 'optimist'],
        mbti: 'INTJ',
        occupation: 'student',
        daily_people: ['mostly-solo'],
        daily_activities: ['work-school'],
        additional_context: 'Motion validation seed persona.',
      },
    },
  );

  expect(response.ok()).toBeTruthy();
}

export function localTodayISO(date = new Date()) {
  return format(date, 'yyyy-MM-dd');
}

export async function browserTodayISO(page: Page) {
  return page.evaluate(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
}
