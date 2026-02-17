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
  uploadFile,
  dismissCookieConsent,
  clickRadioOption,
  clickSubmitButton,
  scrapeFormFields,
  detectSubmissionResult,
  humanDelay,
} from '../browser/form-helpers';
import { handleCaptcha } from '../browser/captcha-handler';

export class LeverApplicationProvider extends BaseApplicationProvider {
  readonly platform = 'lever' as const;

  buildApplicationUrl(jobId: string, boardToken: string): string {
    return `https://jobs.lever.co/${boardToken}/${jobId}/apply`;
  }

  async getFormSchema(jobId: string, boardToken: string): Promise<ApplicationFormSchema> {
    const context = await createApplicationContext();
    const page = await context.newPage();

    try {
      const url = this.buildApplicationUrl(jobId, boardToken);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      await dismissCookieConsent(page);

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

      // Dismiss cookie consent first
      await dismissCookieConsent(page);
      await humanDelay(500, 1000);

      // Fill the form
      await this.fillForm(page, payload);

      // Handle CAPTCHA
      const captchaResult = await handleCaptcha(page);
      if (captchaResult.detected && !captchaResult.solved) {
        console.log(`[lever] CAPTCHA warning: ${captchaResult.error}`);
      }

      // Submit
      await clickSubmitButton(page, 'Submit application');

      // Detect result
      const result = await detectSubmissionResult(page);

      return {
        success: result.success,
        jobId,
        company: boardToken,
        platform: 'lever',
        confirmationId: result.success ? `browser-${Date.now()}` : undefined,
        error: result.success ? undefined : result.message,
        submittedAt: Date.now(),
      };
    } catch (err) {
      return {
        success: false,
        jobId,
        company: boardToken,
        platform: 'lever',
        error: err instanceof Error ? err.message : 'Unknown error',
        submittedAt: Date.now(),
      };
    } finally {
      await page.close();
      await context.close();
    }
  }

  private async fillForm(page: Page, payload: ApplicationPayload): Promise<void> {
    // Upload resume first (via "ATTACH RESUME/CV" button)
    if (payload.resumeFilePath) {
      try {
        await uploadFile(page, 'ATTACH RESUME', payload.resumeFilePath);
      } catch {
        try {
          await uploadFile(page, 'Attach resume', payload.resumeFilePath);
        } catch {
          console.log('[lever] Could not upload resume');
        }
      }
    }

    // Full name (Lever uses a single name field)
    const fullName = `${payload.profile.firstName} ${payload.profile.lastName}`;
    const nameFields: Record<string, string> = {
      'Full name': fullName,
      'Email': payload.profile.email,
      'Phone': payload.profile.phone,
    };

    for (const [label, value] of Object.entries(nameFields)) {
      if (!value) continue;
      try {
        await fillTextField(page, label, value);
      } catch {
        console.log(`[lever] Could not fill field: ${label}`);
      }
    }

    // Optional fields
    const optionalFields: Record<string, string | undefined> = {
      'Current location': payload.profile.location,
      'LinkedIn': payload.profile.linkedinUrl,
      'GitHub': payload.profile.githubUrl,
      'Portfolio': payload.profile.websiteUrl,
    };

    for (const [label, value] of Object.entries(optionalFields)) {
      if (!value) continue;
      try {
        await fillTextField(page, label, value);
      } catch {
        console.log(`[lever] Could not fill field: ${label}`);
      }
    }

    // Cover letter → "Additional information" textarea
    if (payload.coverLetter) {
      try {
        await fillTextField(page, 'Additional information', payload.coverLetter);
      } catch {
        console.log('[lever] Could not fill cover letter');
      }
    }

    // Custom answers (radio questions, text fields)
    if (payload.answers) {
      for (const [label, value] of Object.entries(payload.answers)) {
        try {
          await fillTextField(page, label, value);
        } catch {
          try {
            await clickRadioOption(page, label, value);
          } catch {
            console.log(`[lever] Could not fill custom answer: ${label}`);
          }
        }
      }
    }
  }
}
