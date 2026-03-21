import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginWithPassword,
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

  await page.getByRole('button', { name: /casual/i }).click();

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
  await expect(page.getByRole('heading', { name: /what matters to you\?/i })).toBeVisible();

  const transformSamples = await samplePromise;
  expect(transformSamples.flat().every(isStaticTransform)).toBeTruthy();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
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
