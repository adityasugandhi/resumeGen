import { Page } from 'playwright';
import { BaseApplicationProvider } from './base-provider';
import {
  ApplicationPayload,
  ApplicationResult,
  ApplicationFormSchema,
} from '../types';
import { createApplicationContext } from '../browser/browser-manager';
import {
  fillTextField,
  selectDropdownOption,
  uploadFile,
  clickSubmitButton,
  scrapeFormFields,
  detectSubmissionResult,
  humanDelay,
} from '../browser/form-helpers';
import { handleCaptcha } from '../browser/captcha-handler';

export class GreenhouseApplicationProvider extends BaseApplicationProvider {
  readonly platform = 'greenhouse' as const;

  buildApplicationUrl(jobId: string, boardToken: string): string {
    return `https://job-boards.greenhouse.io/${boardToken}/jobs/${jobId}`;
  }

  async getFormSchema(jobId: string, boardToken: string): Promise<ApplicationFormSchema> {
    const context = await createApplicationContext();
    const page = await context.newPage();

    try {
      const url = this.buildApplicationUrl(jobId, boardToken);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Scroll to the application form
      const applySection = page.locator('text=Apply for this job').first();
      try {
        await applySection.scrollIntoViewIfNeeded({ timeout: 5000 });
      } catch {
        // Form might already be visible
      }

      const fields = await scrapeFormFields(page);
      return { jobId, fields };
    } finally {
      await page.close();
      await context.close();
    }
  }

  async submitApplication(
    jobId: string,
    boardToken: string,
    payload: ApplicationPayload
  ): Promise<ApplicationResult> {
    const context = await createApplicationContext();
    const page = await context.newPage();

    try {
      const url = this.buildApplicationUrl(jobId, boardToken);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Scroll to the application form
      try {
        await page.locator('text=Apply for this job').first().scrollIntoViewIfNeeded({ timeout: 5000 });
      } catch {
        // Form might already be visible
      }
      await humanDelay(500, 1000);

      // Fill standard fields
      await this.fillForm(page, payload);

      // Handle CAPTCHA
      const captchaResult = await handleCaptcha(page);
      if (captchaResult.detected && !captchaResult.solved) {
        console.log(`[greenhouse] CAPTCHA warning: ${captchaResult.error}`);
      }

      // Submit
      await clickSubmitButton(page, 'Submit application');

      // Detect result
      const result = await detectSubmissionResult(page);

      return {
        success: result.success,
        jobId,
        company: boardToken,
        platform: 'greenhouse',
        confirmationId: result.success ? `browser-${Date.now()}` : undefined,
        error: result.success ? undefined : result.message,
        submittedAt: Date.now(),
      };
    } catch (err) {
      return {
        success: false,
        jobId,
        company: boardToken,
        platform: 'greenhouse',
        error: err instanceof Error ? err.message : 'Unknown error',
        submittedAt: Date.now(),
      };
    } finally {
      await page.close();
      await context.close();
    }
  }

  private async fillForm(page: Page, payload: ApplicationPayload): Promise<void> {
    const fieldMap: Record<string, string> = {
      'First Name': payload.profile.firstName,
      'Last Name': payload.profile.lastName,
      'Email': payload.profile.email,
      'Phone': payload.profile.phone,
    };

    // Fill text fields
    for (const [label, value] of Object.entries(fieldMap)) {
      if (!value) continue;
      try {
        await fillTextField(page, label, value);
      } catch {
        console.log(`[greenhouse] Could not fill field: ${label}`);
      }
    }

    // Country dropdown (if present)
    if (payload.profile.location) {
      try {
        await selectDropdownOption(page, 'Country', payload.profile.location);
      } catch {
        console.log('[greenhouse] Could not select country');
      }
    }

    // Upload resume
    if (payload.resumeFilePath) {
      try {
        await uploadFile(page, 'Attach', payload.resumeFilePath);
      } catch {
        console.log('[greenhouse] Could not upload resume');
      }
    }

    // URL fields
    const urlFields: Record<string, string | undefined> = {
      'LinkedIn Profile': payload.profile.linkedinUrl,
      'GitHub URL': payload.profile.githubUrl,
      'Website': payload.profile.websiteUrl,
    };

    for (const [label, value] of Object.entries(urlFields)) {
      if (!value) continue;
      try {
        await fillTextField(page, label, value);
      } catch {
        console.log(`[greenhouse] Could not fill URL field: ${label}`);
      }
    }

    // Cover letter → "Additional Information" textarea
    if (payload.coverLetter) {
      try {
        await fillTextField(page, 'Additional Information', payload.coverLetter);
      } catch {
        console.log('[greenhouse] Could not fill cover letter');
      }
    }

    // Custom answers
    if (payload.answers) {
      for (const [label, value] of Object.entries(payload.answers)) {
        try {
          await fillTextField(page, label, value);
        } catch {
          try {
            await selectDropdownOption(page, label, value);
          } catch {
            console.log(`[greenhouse] Could not fill custom answer: ${label}`);
          }
        }
      }
    }
  }
}
