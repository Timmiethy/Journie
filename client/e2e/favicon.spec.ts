import { test, expect } from '@playwright/test';

test('favicon.svg is present and accessible', async ({ page }) => {
  // Go to the home page or any page
  await page.goto('/');

  // Check if the link tag for the favicon exists with the correct href
  const faviconLink = page.locator('link[rel="icon"]');
  await expect(faviconLink).toHaveAttribute('href', '/favicon.svg');
  await expect(faviconLink).toHaveAttribute('type', 'image/svg+xml');

  // Verify the favicon.svg file is accessible and returns 200 OK
  const response = await page.request.get('/favicon.svg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
  
  const svgContent = await response.text();
  expect(svgContent).toContain('<svg');
  expect(svgContent).toContain('bookGradient');
});
