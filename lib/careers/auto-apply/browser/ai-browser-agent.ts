import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { Page } from 'playwright';
import type { AgentStepEvent } from '@/lib/ai/agent/types';
import { getProfileFromEnv } from '../applicant-profile';
import { selectResume } from '../resume-selector';
import type { ApplicationResult } from '../types';
import { createApplicationContext } from './browser-manager';
import { checkForCaptcha } from './captcha-handler';
import {
  humanDelay,
  fillTextField,
  selectDropdownOption,
  uploadFile,
  clickSubmitButton,
  scrapeFormFields,
  detectSubmissionResult,
  dismissCookieConsent,
} from './form-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIBrowserAgentOptions {
  company: string;
  jobTitle: string;
  jobUrl: string;
  resumePath?: string;
  coverLetter?: string;
  customAnswers?: Record<string, string>;
  dryRun?: boolean;
  onEvent?: (event: AgentStepEvent) => void;
}

// ---------------------------------------------------------------------------
// Claude client factory (Sonnet — cost-effective for form filling)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClient(): { client: any; model: string } {
  const bedrockToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (bedrockToken) {
    const region = process.env.BEDROCK_AWS_REGION ?? 'us-east-1';
    return {
      client: new AnthropicBedrock({
        awsRegion: region,
        skipAuth: true,
        defaultHeaders: { Authorization: `Bearer ${bedrockToken}` },
      }),
      model: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    };
  }

  if (anthropicKey) {
    return {
      client: new Anthropic({ apiKey: anthropicKey }),
      model: 'claude-3-5-sonnet-20241022',
    };
  }

  throw new Error('No Claude API credentials configured for AI browser agent');
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  profileSummary: string,
  resumePath: string,
  coverLetter?: string,
  customAnswers?: Record<string, string>,
): string {
  const customAnswerBlock = customAnswers && Object.keys(customAnswers).length > 0
    ? `\n\nCustom answers provided by the applicant (use these when a matching question appears):\n${Object.entries(customAnswers)
        .map(([q, a]) => `  Q: ${q}\n  A: ${a}`)
        .join('\n')}`
    : '';

  const coverLetterBlock = coverLetter
    ? `\n\nCover letter to paste when a cover letter field is found:\n${coverLetter}`
    : '';

  return `You are a browser automation agent filling a job application form.

## Profile
${profileSummary}

## Resume: ${resumePath}${coverLetterBlock}${customAnswerBlock}

## Tools
browser_snapshot, browser_fill(label,value), browser_click(text), browser_select(label,value), browser_upload(buttonLabel,filePath), report_captcha, submit_form(buttonText)

## Workflow
1. Read the snapshot. Fill ALL visible fields in one turn using multiple browser_fill calls.
2. Upload resume via browser_upload when you see a file input.
3. After filling all fields, take ONE snapshot to verify, then call submit_form.
4. For multi-page forms, click "Next"/"Continue", snapshot, fill, repeat.

## Default Answers (for questions not in profile)
Work authorization: Yes | Sponsorship: Yes (H1B) | Disability/Veteran: Prefer not to say | Gender/Race: Decline to self-identify | Salary: leave blank | How heard: Company website | LinkedIn: https://linkedin.com/in/adityasugandhi | Start date: Immediately | Relocate: Yes

## Critical Rules
- NEVER re-fill a field that already has a value. Skip it.
- Call submit_form as soon as all required fields are filled. In dry-run mode it won't actually submit.
- If you see a CAPTCHA or reCAPTCHA, call report_captcha and stop.
- Be efficient — batch all fills per turn, only snapshot when needed.`;
}

// Accessibility snapshots are now handled by Playwright's built-in
// page.locator('body').ariaSnapshot() which returns a pre-formatted YAML string.

// ---------------------------------------------------------------------------
// Tool definitions (Anthropic tool format)
// ---------------------------------------------------------------------------

const BROWSER_TOOLS = [
  {
    name: 'browser_snapshot',
    description:
      'Take an accessibility snapshot of the current page. Returns a serialized tree of all visible elements with roles, names, and values.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'browser_fill',
    description:
      'Fill a text, email, phone, or URL input field identified by its label.',
    input_schema: {
      type: 'object' as const,
      properties: {
        label: { type: 'string', description: 'The label or accessible name of the input field' },
        value: { type: 'string', description: 'The value to type into the field' },
      },
      required: ['label', 'value'],
    },
  },
  {
    name: 'browser_click',
    description:
      'Click a button, link, or other clickable element by its visible text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The visible text of the element to click' },
      },
      required: ['text'],
    },
  },
  {
    name: 'browser_select',
    description:
      'Select an option from a dropdown or combobox.',
    input_schema: {
      type: 'object' as const,
      properties: {
        label: { type: 'string', description: 'The label of the dropdown/select field' },
        value: { type: 'string', description: 'The option text to select' },
      },
      required: ['label', 'value'],
    },
  },
  {
    name: 'browser_upload',
    description:
      'Upload a file by clicking the upload button and setting the file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        buttonLabel: {
          type: 'string',
          description: 'The text of the upload button or file input label',
        },
        filePath: { type: 'string', description: 'Absolute path to the file to upload' },
      },
      required: ['buttonLabel', 'filePath'],
    },
  },
  {
    name: 'report_captcha',
    description:
      'Report that a CAPTCHA has been detected on the page. This will stop the automation loop.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'submit_form',
    description:
      'Click the submit button and detect the submission result. Only call this after confirming all required fields are filled.',
    input_schema: {
      type: 'object' as const,
      properties: {
        buttonText: {
          type: 'string',
          description: 'The text on the submit button (e.g. "Submit Application", "Apply")',
        },
      },
      required: ['buttonText'],
    },
  },
];

// ---------------------------------------------------------------------------
// AIBrowserAgent
// ---------------------------------------------------------------------------

export class AIBrowserAgent {
  /**
   * Fill and submit a job application form using an AI-driven browser loop.
   * The Claude sub-agent sees accessibility snapshots and decides which form
   * actions to take on each turn.
   */
  async fill(options: AIBrowserAgentOptions): Promise<ApplicationResult> {
    const {
      company,
      jobTitle,
      jobUrl,
      coverLetter,
      customAnswers,
      dryRun = false,
      onEvent,
    } = options;

    const emit = (event: AgentStepEvent) => onEvent?.(event);
    const now = Date.now();

    // Resolve resume path
    const resumePath = options.resumePath ?? selectResume(company, jobTitle);

    // Build applicant profile summary
    const profile = getProfileFromEnv();
    const profileSummary = [
      `Name: ${profile.firstName} ${profile.lastName}`,
      `Email: ${profile.email}`,
      `Phone: ${profile.phone}`,
      profile.location ? `Location: ${profile.location}` : null,
      profile.linkedinUrl ? `LinkedIn: ${profile.linkedinUrl}` : null,
      profile.githubUrl ? `GitHub: ${profile.githubUrl}` : null,
      profile.websiteUrl ? `Website: ${profile.websiteUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    // Create an isolated browser context
    const context = await createApplicationContext();
    let page: Page | null = null;

    try {
      page = await context.newPage();

      // Navigate to the application page
      // Many ATS platforms have the form at /application — try that first
      let applicationUrl = jobUrl;
      if (!jobUrl.endsWith('/application') && !jobUrl.includes('/apply')) {
        applicationUrl = jobUrl.replace(/\/?$/, '/application');
      }
      emit({ type: 'browser_action', action: 'navigate', element: applicationUrl });
      await page.goto(applicationUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await humanDelay(1000, 2000);

      // If the /application URL redirected back or didn't have a form, try clicking "Apply"
      let formFields = await scrapeFormFields(page);
      if (formFields.length === 0) {
        // Look for an "Apply" button or link to click
        try {
          // Try button first, then link, then any text match
          const applyLocators = [
            page.getByRole('button', { name: /apply/i }).first(),
            page.getByRole('link', { name: /apply/i }).first(),
            page.getByText(/apply for this/i).first(),
          ];
          for (const locator of applyLocators) {
            try {
              if (await locator.isVisible({ timeout: 2000 })) {
                emit({ type: 'browser_action', action: 'click', element: 'Apply for this Job' });
                await locator.click();
                await humanDelay(1500, 3000);
                formFields = await scrapeFormFields(page);
                if (formFields.length > 0) break;
              }
            } catch {
              continue;
            }
          }
        } catch {
          // No apply button found, continue with what we have
        }
      }

      // Dismiss cookie banners
      await dismissCookieConsent(page);

      // Early CAPTCHA check
      const hasCaptcha = await checkForCaptcha(page);
      if (hasCaptcha) {
        emit({ type: 'captcha_detected', company, requiresHuman: true });
        return {
          success: false,
          jobId: jobUrl,
          company,
          platform: 'unknown',
          error: 'CAPTCHA detected before form filling could begin',
          submittedAt: now,
        };
      }

      // Take initial accessibility snapshot of the application form
      const initialTree = await page.locator('body').ariaSnapshot().catch(() => '(empty page)');

      emit({
        type: 'form_scraped',
        fieldCount: formFields.length,
        fields: formFields.map((f) => f.label),
      });

      // Build system prompt
      const systemPrompt = buildSystemPrompt(profileSummary, resumePath, coverLetter, customAnswers);

      // Create Claude client
      const { client, model } = createClient();

      // Run sub-agent loop
      const result = await this.runAgentLoop({
        page,
        client,
        model,
        systemPrompt,
        initialTree,
        resumePath,
        dryRun,
        company,
        jobUrl,
        emit,
      });

      return {
        ...result,
        submittedAt: Date.now(),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      emit({ type: 'error', message: `AI browser agent failed: ${errMsg}` });
      return {
        success: false,
        jobId: jobUrl,
        company,
        platform: 'unknown',
        error: errMsg,
        submittedAt: now,
      };
    } finally {
      await context.close();
    }
  }

  // -------------------------------------------------------------------------
  // Sub-agent loop
  // -------------------------------------------------------------------------

  private async runAgentLoop(params: {
    page: Page;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any;
    model: string;
    systemPrompt: string;
    initialTree: string;
    resumePath: string;
    dryRun: boolean;
    company: string;
    jobUrl: string;
    emit: (event: AgentStepEvent) => void;
  }): Promise<Omit<ApplicationResult, 'submittedAt'>> {
    const { page, client, model, systemPrompt, initialTree, resumePath, dryRun, company, jobUrl, emit } = params;

    type ContentBlock = { type: string; [key: string]: unknown };
    type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

    const MAX_TURNS = 20;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
      {
        role: 'user',
        content: `Here is the accessibility snapshot of the job application page. Fill out the form and submit it.\n\n${initialTree}`,
      },
    ];

    let submissionResult: { success: boolean; message: string } | null = null;
    let captchaReported = false;
    const filledFields = new Set<string>(); // Track filled fields to prevent re-filling
    const uploadedFiles = new Set<string>(); // Track uploads to prevent re-uploading
    let consecutiveErrors = 0;

    // Normalize field labels for deduplication: strip *, :, whitespace
    const normalizeLabel = (label: string) => label.toLowerCase().replace(/[*:\s]+/g, '').trim();

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client.messages as any).create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: BROWSER_TOOLS,
        messages,
      });

      const toolUseBlocks = (response.content as ContentBlock[]).filter(
        (block): block is ToolUseBlock => block.type === 'tool_use',
      );

      // If no tool calls, the agent is done thinking
      if (toolUseBlocks.length === 0) {
        break;
      }

      // Push assistant message
      messages.push({ role: 'assistant', content: response.content });

      // Execute each tool call
      const toolResults: { type: 'tool_result'; tool_use_id: string; content: string }[] = [];

      for (const toolUse of toolUseBlocks) {
        const input = toolUse.input;
        let result: string;

        try {
          switch (toolUse.name) {
            // ---- browser_snapshot ----
            case 'browser_snapshot': {
              emit({ type: 'browser_action', action: 'snapshot', element: 'page' });
              await humanDelay(300, 600);
              result = await page.locator('body').ariaSnapshot().catch(() => '(empty page — no accessible elements found)');
              break;
            }

            // ---- browser_fill ----
            case 'browser_fill': {
              const label = String(input.label);
              const value = String(input.value);
              const fieldKey = normalizeLabel(label);
              if (filledFields.has(fieldKey)) {
                result = `Field "${label}" was already filled — skipping. Call submit_form now if all required fields are done.`;
                break;
              }
              emit({ type: 'browser_action', action: 'fill', element: `${label}: ${value}` });
              await humanDelay(200, 400);
              await fillTextField(page, label, value);
              filledFields.add(fieldKey);
              result = `Filled "${label}" with "${value}". Fields filled so far: ${filledFields.size}`;
              break;
            }

            // ---- browser_click ----
            case 'browser_click': {
              const text = String(input.text);
              emit({ type: 'browser_action', action: 'click', element: text });
              await humanDelay(200, 400);
              try {
                await page.getByRole('button', { name: text, exact: false }).first().click({ timeout: 5000 });
              } catch {
                // Fallback: click by text content
                await page.getByText(text, { exact: false }).first().click({ timeout: 5000 });
              }
              await humanDelay(500, 1000);
              result = `Clicked "${text}"`;
              break;
            }

            // ---- browser_select ----
            case 'browser_select': {
              const label = String(input.label);
              const value = String(input.value);
              emit({ type: 'browser_action', action: 'select', element: `${label}: ${value}` });
              await humanDelay(200, 400);
              await selectDropdownOption(page, label, value);
              result = `Selected "${value}" in "${label}"`;
              break;
            }

            // ---- browser_upload ----
            case 'browser_upload': {
              const buttonLabel = String(input.buttonLabel);
              const filePath = String(input.filePath || resumePath);
              const uploadKey = normalizeLabel(buttonLabel);
              if (uploadedFiles.has(uploadKey)) {
                result = `File already uploaded via "${buttonLabel}" — skipping. Call submit_form now if all fields are done.`;
                break;
              }
              emit({ type: 'browser_action', action: 'upload', element: buttonLabel });
              await humanDelay(300, 600);
              await uploadFile(page, buttonLabel, filePath);
              uploadedFiles.add(uploadKey);
              result = `Uploaded file "${filePath}" via "${buttonLabel}"`;
              break;
            }

            // ---- report_captcha ----
            case 'report_captcha': {
              emit({ type: 'captcha_detected', company, requiresHuman: true });
              captchaReported = true;
              result = 'CAPTCHA reported. Stopping automation.';
              break;
            }

            // ---- submit_form ----
            case 'submit_form': {
              const buttonText = String(input.buttonText);
              emit({ type: 'browser_action', action: 'submit', element: buttonText });

              if (dryRun) {
                submissionResult = { success: true, message: 'Dry run — form not actually submitted' };
                result = `[DRY RUN] Would click "${buttonText}" to submit. Form filling complete.`;
              } else {
                await humanDelay(500, 1000);
                await clickSubmitButton(page, buttonText);
                await humanDelay(2000, 4000);
                submissionResult = await detectSubmissionResult(page);
                result = submissionResult.success
                  ? `Form submitted successfully: ${submissionResult.message}`
                  : `Submission issue: ${submissionResult.message}`;
              }
              break;
            }

            default:
              result = `Unknown tool: ${toolUse.name}`;
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          result = `Tool error (${toolUse.name}): ${errMsg}`;
          consecutiveErrors++;
          // If we hit too many consecutive errors, force submit attempt
          if (consecutiveErrors >= 5) {
            result += '\n\n⚠️ Multiple consecutive errors detected. You should call submit_form now with whatever fields are filled, or stop trying to interact with broken elements.';
          }
        }

        // Reset error counter on successful tool execution
        if (!result.startsWith('Tool error')) {
          consecutiveErrors = 0;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });

        // Early exit conditions
        if (captchaReported || submissionResult) {
          break;
        }
      }

      // Inject urgency reminder when approaching turn limit or if many fields already filled
      const shouldNudge = turn >= MAX_TURNS - 8 || (filledFields.size >= 5 && turn >= 8);
      if (shouldNudge) {
        const reminderContent: Array<{ type: 'tool_result'; tool_use_id: string; content: string } | { type: 'text'; text: string }> = [
          ...toolResults,
          { type: 'text', text: `⚠️ TURN ${turn + 1}/${MAX_TURNS} — ${filledFields.size} fields filled. If all required fields are done, call submit_form NOW. Do NOT re-fill any fields.` },
        ];
        messages.push({ role: 'user', content: reminderContent });
      } else {
        messages.push({ role: 'user', content: toolResults });
      }

      // Stop if CAPTCHA was reported or form was submitted
      if (captchaReported) {
        return {
          success: false,
          jobId: jobUrl,
          company,
          platform: 'unknown',
          error: 'CAPTCHA detected during form filling — requires human intervention',
        };
      }

      if (submissionResult) {
        return {
          success: submissionResult.success,
          jobId: jobUrl,
          company,
          platform: 'unknown',
          confirmationId: submissionResult.success ? `ai-browser-${Date.now()}` : undefined,
          error: submissionResult.success ? undefined : submissionResult.message,
        };
      }
    }

    // Agent exhausted all turns without submitting
    return {
      success: false,
      jobId: jobUrl,
      company,
      platform: 'unknown',
      error: `AI browser agent exhausted ${MAX_TURNS} turns without submitting (${filledFields.size} fields were filled)`,
    };
  }
}
