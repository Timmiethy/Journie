import { expect, test } from '@playwright/test';
import {
  browserTodayISO,
  createConfirmedUser,
  loginToHome,
  loginWithPassword,
  seedPersona,
  serverEnv,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 430, height: 932 },
  reducedMotion: 'reduce',
});

test('onboarding step transitions collapse to opacity-only when reduced motion is enabled', async ({
  page,
}) => {
  test.setTimeout(60000);

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

  const { email, password } = await createConfirmedUser(page.request);
  await loginWithPassword(page, email, password, '**/onboarding');

  await page.getByRole('button', { name: /unhinged memes/i }).click();

  const samplePromise = page.evaluate(() => {
    return new Promise<string[][]>((resolve) => {
      const samples: string[][] = [];
      let frame = 0;

      const sample = () => {
        const transforms = Array.from(
          document.querySelectorAll('[data-testid="survey-step-panel"]'),
        ).map((panel) => window.getComputedStyle(panel).transform);
        samples.push(transforms);
        frame += 1;
        if (frame >= 12) {
          resolve(samples);
          return;
        }
        requestAnimationFrame(sample);
      };

      requestAnimationFrame(sample);
    });
  });

  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByRole('heading', { name: /how does this (?:current )?chapter of your life feel\?/i })).toBeVisible();

  const transformSamples = await samplePromise;
  expect(transformSamples.flat().every(isStaticTransform)).toBeTruthy();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('journal generating state falls back to a static reduced-motion loader', async ({ page, request }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);

  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const today = await browserTodayISO(page);

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

  await expect(page.getByTestId('journal-generating-cursor')).toBeVisible();
  await expect(page.getByRole('button', { name: /edit/i })).toHaveCount(0);
  await expect(page.getByTestId('journal-generating-message')).toHaveText('Writing the script...');

  const cursorClassName = await page.getByTestId('journal-generating-cursor').evaluate((element) => {
    return element.className;
  });
  expect(cursorClassName).not.toContain('animate-pulse');

  await page.waitForTimeout(3200);
  await expect(page.getByTestId('journal-generating-message')).toHaveText('Writing the script...');
});

function isStaticTransform(transform: string) {
  if (transform === 'none') {
    return true;
  }

  const values = transform.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (transform.startsWith('matrix3d(') && values.length >= 14) {
    return Math.abs(values[12]) < 0.5 && Math.abs(values[13]) < 0.5;
  }

  if (transform.startsWith('matrix(') && values.length >= 6) {
    return Math.abs(values[4]) < 0.5 && Math.abs(values[5]) < 0.5;
  }

  return false;
}


