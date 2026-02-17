import { Page } from 'playwright';

export interface CaptchaResult {
  detected: boolean;
  solved: boolean;
  error?: string;
}

/**
 * Check if the page has a reCAPTCHA iframe.
 */
export async function checkForCaptcha(page: Page): Promise<boolean> {
  try {
    const captchaFrame = page.frameLocator('iframe[src*="recaptcha"]').first();
    const checkbox = captchaFrame.locator('.recaptcha-checkbox-border');
    return await checkbox.isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

/**
 * Handle reCAPTCHA:
 * - Headless mode: attempt to proceed (reCAPTCHA v3 often auto-passes)
 * - Headed mode: wait for manual solving (up to 120s)
 */
export async function handleCaptcha(page: Page): Promise<CaptchaResult> {
  const hasCaptcha = await checkForCaptcha(page);

  if (!hasCaptcha) {
    return { detected: false, solved: true };
  }

  const isHeaded = process.env.AUTO_APPLY_HEADED === 'true';

  if (!isHeaded) {
    // In headless mode, try to proceed anyway — reCAPTCHA v3 may auto-pass
    console.log('[captcha] reCAPTCHA detected in headless mode, attempting to proceed...');
    return {
      detected: true,
      solved: false,
      error:
        'reCAPTCHA detected. Set AUTO_APPLY_HEADED=true and solve manually, or the v3 challenge may auto-pass on submit.',
    };
  }

  // Headed mode: wait for user to solve manually
  console.log('[captcha] reCAPTCHA detected — please solve it in the browser window (120s timeout)...');

  try {
    // Wait for the reCAPTCHA checkbox to become checked
    await page.waitForFunction(
      () => {
        const iframe = document.querySelector<HTMLIFrameElement>(
          'iframe[src*="recaptcha"]'
        );
        if (!iframe?.contentDocument) return false;
        const checkbox = iframe.contentDocument.querySelector(
          '.recaptcha-checkbox-checked'
        );
        return !!checkbox;
      },
      { timeout: 120_000 }
    );

    console.log('[captcha] reCAPTCHA solved manually.');
    return { detected: true, solved: true };
  } catch {
    return {
      detected: true,
      solved: false,
      error: 'reCAPTCHA not solved within 120 seconds.',
    };
  }
}
