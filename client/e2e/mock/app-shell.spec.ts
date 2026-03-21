import { expect, test } from '@playwright/test';

test.describe('@mock app shell', () => {
  test.use({
    viewport: { width: 430, height: 932 },
  });

  test('renders the auth shell without backend data', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { name: /journie/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
    await expect(page.getByPlaceholder('email')).toBeVisible();
  });

  test('redirects unknown routes to auth for anonymous users', async ({ page }) => {
    await page.goto('/not-a-real-route');

    await page.waitForURL('**/auth');
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
  });

  test('resolver falls back to auth when no session is present', async ({ page }) => {
    await page.goto('/auth/resolver');

    await page.waitForURL('**/auth');
    await expect(page.getByPlaceholder('password')).toBeVisible();
  });
});
