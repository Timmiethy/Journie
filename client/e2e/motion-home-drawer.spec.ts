import { expect, test, type Page } from '@playwright/test';
import {
  browserTodayISO,
  createConfirmedUser,
  loginToHome,
  seedPersona,
  serverEnv,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 390, height: 844 },
});

async function dragActivityHandle(page: Page, deltaY: number) {
  const handle = page.getByTestId('home-activity-handle');
  const box = await handle.boundingBox();
  if (!box) {
    throw new Error('Activity handle bounds were not available.');
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + deltaY, { steps: 8 });
  await page.mouse.up();
}

async function beginActivityHandleDrag(page: Page) {
  const handle = page.getByTestId('home-activity-handle');
  const box = await handle.boundingBox();
  if (!box) {
    throw new Error('Activity handle bounds were not available.');
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();

  return { startX, startY };
}

async function expectSheetState(page: Page, state: 'collapsed' | 'peek' | 'full') {
  await expect(page.getByTestId('home-activity-sheet')).toHaveAttribute('data-sheet-state', state);
}

async function getViewportHeight(page: Page) {
  return page.evaluate(() => window.innerHeight);
}

test('home first viewport stays compact with a collapsed activity sheet when there is no activity yet', async ({ page, request }) => {
  test.setTimeout(90000);

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);
  await loginToHome(page, email, password);

  await expect(page.getByRole('button', { name: /^journal$/i })).toBeVisible();
  await expect(page.getByTestId('home-activity-handle')).toBeVisible();
  await expectSheetState(page, 'collapsed');
  await expect(page.getByText(/good (morning|afternoon|evening)/i)).toHaveCount(0);
  await expect(page.getByText(/^queued$/i)).toHaveCount(0);
  await expect(page.getByText(/^today$/i)).toHaveCount(0);

  const fitsViewport = await page.evaluate(() => {
    return document.documentElement.scrollHeight <= window.innerHeight + 4;
  });

  expect(fitsViewport).toBeTruthy();
});

test('home bottom sheet follows the first pull smoothly, then expands to full on the next interaction', async ({ page, request }) => {
  test.setTimeout(120000);

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);

  const headers = {
    apikey: serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${serverEnv.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const capturedAt = new Date().toISOString();
  const dayDate = await browserTodayISO(page);

  const createMomentResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/moments`, {
    headers,
    data: {
      user_id: userId,
      day_date: dayDate,
      order_index: 0,
      text_context: 'Drawer validation moment',
      voice_transcript: null,
      mood: 'good',
      captured_at: capturedAt,
    },
  });

  expect(createMomentResponse.ok()).toBeTruthy();
  const createdMoment = (await createMomentResponse.json()) as Array<{ id: string }>;

  const createPhotoResponse = await page.request.post(`${serverEnv.SUPABASE_URL}/rest/v1/moment_photos`, {
    headers,
    data: {
      moment_id: createdMoment[0].id,
      storage_path: `drawer/${createdMoment[0].id}.png`,
      photo_url: `data:image/png;base64,${'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pRyxu8AAAAASUVORK5CYII='}`,
      order_index: 0,
      created_at: capturedAt,
    },
  });

  expect(createPhotoResponse.ok()).toBeTruthy();

  await loginToHome(page, email, password);

  const viewportHeight = await getViewportHeight(page);
  const collapsedSheet = await page.getByTestId('home-activity-sheet').boundingBox();
  const cameraBefore = await page.getByTestId('capture-morph').boundingBox();
  if (!collapsedSheet || !cameraBefore) {
    throw new Error('Initial sheet or camera bounds were not available before opening the sheet.');
  }

  const dragStart = await beginActivityHandleDrag(page);
  await page.mouse.move(dragStart.startX, dragStart.startY - 140, { steps: 10 });
  await expect
    .poll(async () => {
      const draggingBox = await page.getByTestId('home-activity-sheet').boundingBox();
      return draggingBox?.height ?? 0;
    })
    .toBeGreaterThan(collapsedSheet.height + 56);
  await expect
    .poll(async () => {
      const draggingCamera = await page.getByTestId('capture-morph').boundingBox();
      return draggingCamera?.y ?? cameraBefore.y;
    })
    .toBeLessThan(cameraBefore.y);
  await page.mouse.up();

  await expectSheetState(page, 'peek');
  await expect
    .poll(async () => await page.getByTestId('today-moment-card').count())
    .toBe(1);
  await expect(page.getByTestId('home-start-journal-button')).toBeVisible();

  const sheetPeek = await page.getByTestId('home-activity-sheet').boundingBox();
  const cameraPeek = await page.getByTestId('capture-morph').boundingBox();
  if (!sheetPeek || !cameraPeek) {
    throw new Error('Peek state bounds were not available.');
  }

  expect(sheetPeek.height).toBeLessThanOrEqual(viewportHeight * 0.41);
  expect(cameraPeek.y).toBeLessThan(cameraBefore.y);
  expect(cameraPeek.y + cameraPeek.height).toBeLessThanOrEqual(viewportHeight);

  await page.getByTestId('home-activity-handle').click();
  await expectSheetState(page, 'full');
  await expect(page.getByTestId('home-activity-full-grid')).toBeVisible();
  await expect
    .poll(async () => {
      const fullBox = await page.getByTestId('home-activity-sheet').boundingBox();
      return fullBox?.height ?? 0;
    })
    .toBeGreaterThan(sheetPeek.height + 120);
  await expect
    .poll(async () => {
      const fullBox = await page.getByTestId('home-activity-sheet').boundingBox();
      return fullBox?.y ?? viewportHeight;
    })
    .toBeLessThanOrEqual(viewportHeight * 0.1);
  await expect
    .poll(async () => {
      const fullCamera = await page.getByTestId('capture-morph').boundingBox();
      return fullCamera?.y ?? 0;
    })
    .toBeLessThan(cameraPeek.y);
  await expect
    .poll(async () => {
      const heroOpacity = await page.getByTestId('home-hero-stage').evaluate((element) => {
        return Number.parseFloat(window.getComputedStyle(element).opacity || '1');
      });
      return heroOpacity;
    })
    .toBeLessThan(0.05);

  await page.getByTestId('home-activity-handle').click();
  await expectSheetState(page, 'peek');
});
