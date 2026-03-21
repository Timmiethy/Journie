import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  loginToHome,
  pngBuffer,
  seedPersona,
} from './helpers/app-flow.ts';

test.use({
  viewport: { width: 430, height: 932 },
});

test('home live camera queues multiple captures before review opens', async ({ page, request }) => {
  test.setTimeout(120000);

  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { __journieSrcObject?: unknown }).__journieSrcObject ?? null;
      },
      set(value) {
        (this as HTMLMediaElement & { __journieSrcObject?: unknown }).__journieSrcObject = value;
      },
    });

    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get() {
        return 1080;
      },
    });

    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get() {
        return 1080;
      },
    });

    HTMLMediaElement.prototype.play = async () => {};

    HTMLCanvasElement.prototype.getContext = function getContext(type, options) {
      const context = originalGetContext.call(this, type, options);
      if (context) {
        context.drawImage = () => {};
      }
      return context;
    };

    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
      callback(new Blob(['fake-camera'], { type: 'image/jpeg' }));
    };

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        configurable: true,
      });
    }

    navigator.mediaDevices.getUserMedia = async () => ({
      getTracks: () => [{ stop() {} }],
    } as MediaStream);
  });

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);
  await loginToHome(page, email, password);

  await expect(page.getByTestId('camera-video')).toBeVisible({ timeout: 20000 });

  const captureButton = page.getByRole('button', { name: /capture photo/i });
  await captureButton.click();
  await captureButton.click();
  await captureButton.click();

  await expect(page.getByText(/3 queued/i)).toBeVisible();
  await expect(page.getByTestId('home-activity-sheet')).toHaveAttribute('data-sheet-state', 'peek');
  await expect(page.getByTestId('camera-review-button')).toContainText('review (3)');

  await page.getByTestId('camera-review-button').click();
  await expect(page.getByText(/^review$/i)).toBeVisible();
});

test('camera denial falls back to library import without dead-ending home', async ({ page, request }) => {
  test.setTimeout(120000);

  await page.addInitScript(() => {
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        configurable: true,
      });
    }

    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });

  const { email, password, userId } = await createConfirmedUser(request);
  await seedPersona(request, userId);
  await loginToHome(page, email, password);

  await expect(page.getByTestId('camera-fallback')).toBeVisible();
  await expect(page.getByText(/camera access was denied/i)).toBeVisible();

  await page.getByTestId('home-library-input').setInputFiles({
    name: 'camera-denied-library.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/^review$/i)).toBeVisible();
});
