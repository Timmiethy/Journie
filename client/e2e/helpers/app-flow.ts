import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

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
export const clientEnv = readEnvFile(path.resolve(helperDirectory, '../../../client/.env'));
export const validationDirectory = path.resolve(helperDirectory, '../../../tasks/validation');

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer: Buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createSolidPngBuffer(width: number, height: number) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(width * 4, 0);
  for (let i = 0; i < width; i += 1) {
    const offset = i * 4;
    row[offset] = 112;
    row[offset + 1] = 160;
    row[offset + 2] = 255;
    row[offset + 3] = 255;
  }

  const raw = Buffer.alloc((row.length + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (row.length + 1);
    raw[start] = 0;
    row.copy(raw, start + 1);
  }

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export const pngBuffer = createSolidPngBuffer(32, 32);
const supabaseAnonKey = clientEnv.VITE_SUPABASE_ANON_KEY || serverEnv.SUPABASE_ANON_KEY;

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
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
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
