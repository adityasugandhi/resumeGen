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
  clickRadioOption,
  clickCheckboxOption,
  clickSubmitButton,
  scrapeFormFields,
  detectSubmissionResult,
  humanDelay,
} from '../browser/form-helpers';
import { handleCaptcha } from '../browser/captcha-handler';

export class AshbyApplicationProvider extends BaseApplicationProvider {
  readonly platform = 'ashby' as const;

  buildApplicationUrl(jobId: string, boardToken: string): string {
    return `https://jobs.ashbyhq.com/${boardToken}/${jobId}/application`;
  }

  async getFormSchema(jobId: string, boardToken: string): Promise<ApplicationFormSchema> {
    const context = await createApplicationContext();
    const page = await context.newPage();

    try {
      const url = this.buildApplicationUrl(jobId, boardToken);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Click "Application" tab if present
      await this.clickApplicationTab(page);

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

      // Click "Application" tab if present
      await this.clickApplicationTab(page);
      await humanDelay(500, 1000);

      // Fill the form
      await this.fillForm(page, payload);

      // Handle CAPTCHA
      const captchaResult = await handleCaptcha(page);
      if (captchaResult.detected && !captchaResult.solved) {
        console.log(`[ashby] CAPTCHA warning: ${captchaResult.error}`);
      }

      // Submit
      await clickSubmitButton(page, 'Submit Application');

      // Detect result
      const result = await detectSubmissionResult(page);

      return {
        success: result.success,
        jobId,
        company: boardToken,
        platform: 'ashby',
        confirmationId: result.success ? `browser-${Date.now()}` : undefined,
        error: result.success ? undefined : result.message,
        submittedAt: Date.now(),
      };
    } catch (err) {
      return {
        success: false,
        jobId,
        company: boardToken,
        platform: 'ashby',
        error: err instanceof Error ? err.message : 'Unknown error',
        submittedAt: Date.now(),
      };
    } finally {
      await page.close();
      await context.close();
    }
  }

  private async clickApplicationTab(page: Page): Promise<void> {
    try {
      const tab = page.getByRole('tab', { name: 'Application' }).first();
      if (await tab.isVisible({ timeout: 3000 })) {
        await tab.click();
        await humanDelay(500, 1000);
      }
    } catch {
      // No tab found — form is likely directly visible
    }
  }

  private async fillForm(page: Page, payload: ApplicationPayload): Promise<void> {
    // Full Name / Legal Name (Ashby uses single name field, label varies)
    const fullName = `${payload.profile.firstName} ${payload.profile.lastName}`;

    // Try "Full Name" first, then "Legal Name"
    let nameFilled = false;
    for (const nameLabel of ['Full Name', 'Legal Name', 'Name']) {
      if (nameFilled) break;
      try {
        await fillTextField(page, nameLabel, fullName);
        nameFilled = true;
      } catch {
        // Try next label variant
      }
    }
    if (!nameFilled) console.log('[ashby] Could not fill name field');

    const textFields: Record<string, string> = {
      'Email': payload.profile.email,
      'Phone': payload.profile.phone,
    };

    for (const [label, value] of Object.entries(textFields)) {
      if (!value) continue;
      try {
        await fillTextField(page, label, value);
      } catch {
        console.log(`[ashby] Could not fill field: ${label}`);
      }
    }

    // Location autocomplete — type slowly and select first suggestion
    if (payload.profile.location) {
      try {
        const locationInput = page.getByLabel('Location', { exact: false }).first();
        await locationInput.click();
        await humanDelay(200, 400);
        // Type slowly for autocomplete to trigger
        await locationInput.pressSequentially(payload.profile.location, { delay: 50 });
        await humanDelay(500, 800);
        // Select first autocomplete suggestion
        const suggestion = page.getByRole('option').first();
        try {
          await suggestion.click({ timeout: 3000 });
        } catch {
          await locationInput.press('Enter');
        }
        await humanDelay(200, 400);
      } catch {
        console.log('[ashby] Could not fill location');
      }
    }

    // Upload resume
    if (payload.resumeFilePath) {
      try {
        await uploadFile(page, 'Upload File', payload.resumeFilePath);
      } catch {
        try {
          await uploadFile(page, 'Upload', payload.resumeFilePath);
        } catch {
          console.log('[ashby] Could not upload resume');
        }
      }
    }

    // LinkedIn Profile
    if (payload.profile.linkedinUrl) {
      try {
        await fillTextField(page, 'LinkedIn Profile', payload.profile.linkedinUrl);
      } catch {
        try {
          await fillTextField(page, 'LinkedIn', payload.profile.linkedinUrl);
        } catch {
          console.log('[ashby] Could not fill LinkedIn');
        }
      }
    }

    // GitHub URL
    if (payload.profile.githubUrl) {
      try {
        await fillTextField(page, 'GitHub', payload.profile.githubUrl);
      } catch {
        console.log('[ashby] Could not fill GitHub');
      }
    }

    // Website
    if (payload.profile.websiteUrl) {
      try {
        await fillTextField(page, 'Website', payload.profile.websiteUrl);
      } catch {
        console.log('[ashby] Could not fill website');
      }
    }

    // Custom answers (radio/checkbox groups, text)
    if (payload.answers) {
      for (const [label, value] of Object.entries(payload.answers)) {
        try {
          await fillTextField(page, label, value);
        } catch {
          try {
            await clickRadioOption(page, label, value);
          } catch {
            try {
              await clickCheckboxOption(page, label, value);
            } catch {
              console.log(`[ashby] Could not fill custom answer: ${label}`);
            }
          }
        }
      }
    }
  }
}
