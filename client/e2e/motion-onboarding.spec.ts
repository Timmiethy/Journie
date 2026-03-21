import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginWithPassword,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 430, height: 932 },
});

const screenshotDir = path.resolve('client/test-results/validation/component-4');

test('onboarding transition container stays non-zero and rapid next does not double-advance', async ({ page }) => {
  test.setTimeout(60000);
  fs.mkdirSync(screenshotDir, { recursive: true });

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
  await page.screenshot({
    path: path.join(screenshotDir, 'onboarding-step-0.png'),
    fullPage: true,
  });

  const heightsPromise = page.evaluate(() => {
    const container = document.querySelector('[data-testid="survey-step-container"]');
    return new Promise<number[]>((resolve) => {
      const heights: number[] = [];
      let frame = 0;
      const sample = () => {
        heights.push(container?.getBoundingClientRect().height ?? 0);
        frame += 1;
        if (frame >= 24) {
          resolve(heights);
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });

  const exitingPanelStatePromise = page.evaluate(() => {
    return new Promise<{
      ariaHidden: string | null;
      pointerEvents: string;
      tabIndex: string | null;
    } | null>((resolve) => {
      window.setTimeout(() => {
        const panels = Array.from(document.querySelectorAll('[data-testid="survey-step-panel"]'));
        const exitingPanel = panels.find((panel) => panel.getAttribute('aria-hidden') === 'true');

        if (!exitingPanel) {
          resolve(null);
          return;
        }

        const styles = window.getComputedStyle(exitingPanel as HTMLElement);
        resolve({
          ariaHidden: exitingPanel.getAttribute('aria-hidden'),
          pointerEvents: styles.pointerEvents,
          tabIndex: exitingPanel.getAttribute('tabindex'),
        });
      }, 50);
    });
  });

  await page.getByRole('button', { name: /^next$/i }).dblclick();

  const heights = await heightsPromise;
  expect(Math.min(...heights)).toBeGreaterThan(0);

  await expect(page.getByRole('heading', { name: /what matters to you\?/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /how do you talk to yourself\?/i })).toHaveCount(0);

  const exitingPanelState = await exitingPanelStatePromise;

  if (exitingPanelState) {
    expect(exitingPanelState).toEqual({
      ariaHidden: 'true',
      pointerEvents: 'none',
      tabIndex: '-1',
    });
  }

  await page.screenshot({
    path: path.join(screenshotDir, 'onboarding-step-1.png'),
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
