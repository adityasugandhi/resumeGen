import { Page } from 'playwright';
import { ApplicationFormField } from '../types';

/**
 * Random delay between min and max milliseconds for human-like pacing.
 */
export async function humanDelay(min = 300, max = 800): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fill a text field identified by its label with human-like typing delays.
 */
export async function fillTextField(
  page: Page,
  label: string,
  value: string
): Promise<void> {
  const input = page.getByLabel(label, { exact: false }).first();
  await input.click();
  await humanDelay(100, 200);
  await input.fill(value);
  await humanDelay(200, 400);
}

/**
 * Select a dropdown/combobox option by label text.
 */
export async function selectDropdownOption(
  page: Page,
  label: string,
  value: string
): Promise<void> {
  const combobox = page.getByLabel(label, { exact: false }).first();
  const tagName = await combobox.evaluate((el) => el.tagName.toLowerCase());

  if (tagName === 'select') {
    await combobox.selectOption({ label: value });
  } else {
    // Combobox pattern — click to open, then type and select
    await combobox.click();
    await humanDelay(200, 400);
    await combobox.fill(value);
    await humanDelay(500, 800);
    // Select first matching option from dropdown suggestions
    const option = page.getByRole('option', { name: value }).first();
    try {
      await option.click({ timeout: 3000 });
    } catch {
      // If no option found, press Enter to accept typed value
      await combobox.press('Enter');
    }
  }
  await humanDelay(200, 400);
}

/**
 * Upload a file by triggering the file chooser when clicking a button.
 */
export async function uploadFile(
  page: Page,
  buttonLabel: string,
  filePath: string
): Promise<void> {
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 10000 }),
    page.getByText(buttonLabel, { exact: false }).first().click(),
  ]);
  await fileChooser.setFiles(filePath);
  await humanDelay(500, 1000);
}

/**
 * Dismiss cookie consent banners if present.
 */
export async function dismissCookieConsent(page: Page): Promise<void> {
  const consentSelectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Accept Cookies")',
    'button:has-text("Got it")',
    'button:has-text("I agree")',
    'button:has-text("OK")',
    '[class*="cookie"] button',
    '[id*="cookie"] button',
  ];

  for (const selector of consentSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await humanDelay(300, 600);
        return;
      }
    } catch {
      // Selector not found, try next
    }
  }
}

/**
 * Click a radio button option within a labeled group.
 */
export async function clickRadioOption(
  page: Page,
  groupLabel: string,
  value: string
): Promise<void> {
  // Try to find the radio by its label within a fieldset/group
  const radio = page
    .locator(`fieldset:has(legend:has-text("${groupLabel}"))`)
    .getByLabel(value, { exact: false })
    .first();

  try {
    await radio.click({ timeout: 3000 });
  } catch {
    // Fallback: look for radio anywhere on the page near the group label
    const fallback = page.getByLabel(value, { exact: false }).first();
    await fallback.click({ timeout: 3000 });
  }
  await humanDelay(200, 400);
}

/**
 * Click a checkbox option within a labeled group.
 */
export async function clickCheckboxOption(
  page: Page,
  groupLabel: string,
  value: string
): Promise<void> {
  const checkbox = page
    .locator(`fieldset:has(legend:has-text("${groupLabel}"))`)
    .getByLabel(value, { exact: false })
    .first();

  try {
    await checkbox.check({ timeout: 3000 });
  } catch {
    const fallback = page.getByLabel(value, { exact: false }).first();
    await fallback.check({ timeout: 3000 });
  }
  await humanDelay(200, 400);
}

/**
 * Click the submit button by its text.
 */
export async function clickSubmitButton(
  page: Page,
  buttonText: string
): Promise<void> {
  const btn = page.getByRole('button', { name: buttonText, exact: false }).first();
  await btn.scrollIntoViewIfNeeded();
  await humanDelay(300, 600);
  await btn.click();
}

/**
 * Scrape all visible form fields from the current page.
 */
export async function scrapeFormFields(page: Page): Promise<ApplicationFormField[]> {
  const fields: ApplicationFormField[] = [];
  const seenIds = new Set<string>();

  // Scrape labeled inputs, textareas, selects
  const formElements = await page.locator('input, textarea, select').all();

  for (const el of formElements) {
    try {
      const isVisible = await el.isVisible();
      if (!isVisible) continue;

      const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
      const type = await el.getAttribute('type') || '';
      const name = await el.getAttribute('name') || '';
      const id = await el.getAttribute('id') || '';
      const required = (await el.getAttribute('required')) !== null ||
        (await el.getAttribute('aria-required')) === 'true';

      // Get label text
      let label = '';
      const ariaLabel = await el.getAttribute('aria-label');
      if (ariaLabel) {
        label = ariaLabel;
      } else if (id) {
        const labelEl = page.locator(`label[for="${id}"]`).first();
        try {
          label = await labelEl.textContent({ timeout: 1000 }) || '';
        } catch {
          // no label found
        }
      }
      if (!label) label = name || id;
      if (!label) continue;

      // Skip hidden/submit fields
      if (['hidden', 'submit', 'button'].includes(type)) continue;

      let fieldType: ApplicationFormField['type'] = 'text';
      if (tagName === 'textarea') fieldType = 'textarea';
      else if (tagName === 'select') fieldType = 'select';
      else if (type === 'file') fieldType = 'file';
      else if (type === 'email') fieldType = 'email';
      else if (type === 'tel') fieldType = 'phone';
      else if (type === 'url') fieldType = 'url';
      else if (type === 'checkbox') fieldType = 'checkbox';

      // Get select options
      let options: string[] | undefined;
      if (tagName === 'select') {
        options = await el.locator('option').allTextContents();
        options = options.filter((o) => o.trim());
      }

      // Deduplicate by field ID + label combination
      const fieldKey = `${name || id || label}::${label.trim()}`;
      if (seenIds.has(fieldKey)) continue;
      seenIds.add(fieldKey);

      fields.push({
        id: name || id || label,
        label: label.trim(),
        type: fieldType,
        required,
        options,
      });
    } catch {
      // Skip elements that can't be processed
    }
  }

  return fields;
}

/**
 * Wait for submission confirmation or detect errors after clicking submit.
 */
export async function detectSubmissionResult(
  page: Page
): Promise<{ success: boolean; message: string }> {
  const successPatterns = [
    'thank you',
    'application submitted',
    'successfully submitted',
    'application received',
    'thanks for applying',
    'we have received your application',
  ];

  const errorPatterns = [
    'error',
    'something went wrong',
    'please try again',
    'failed to submit',
    'required field',
  ];

  try {
    // Wait up to 10 seconds for page change or confirmation text
    await page.waitForTimeout(3000);
    const bodyText = (await page.textContent('body'))?.toLowerCase() || '';

    for (const pattern of successPatterns) {
      if (bodyText.includes(pattern)) {
        return { success: true, message: pattern };
      }
    }

    for (const pattern of errorPatterns) {
      if (bodyText.includes(pattern)) {
        return { success: false, message: `Form error detected: ${pattern}` };
      }
    }

    // Check if URL changed (often indicates success)
    const currentUrl = page.url();
    if (currentUrl.includes('thank') || currentUrl.includes('success') || currentUrl.includes('confirmation')) {
      return { success: true, message: 'URL changed to confirmation page' };
    }

    return { success: true, message: 'Form submitted (no explicit confirmation detected)' };
  } catch {
    return { success: false, message: 'Timeout waiting for submission result' };
  }
}
