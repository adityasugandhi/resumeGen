import { ApplicationQueue } from '../lib/cron/application-queue';
import { PersistentTracker } from '../lib/careers/auto-apply/tracker';
import { JobApplicationEngine } from '../lib/careers/auto-apply/engine';
import { SlackNotifier, type SubmissionSummary } from '../lib/cron/slack-notifier';
import { loadCronConfig } from '../lib/cron/cron-config';

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const config = loadCronConfig();

  const queue = new ApplicationQueue();
  const tracker = new PersistentTracker();
  const notifier = new SlackNotifier(config.slack.webhookUrl);

  const approved = await queue.listByStatus('approved');
  if (approved.length === 0) {
    console.log('[submit] No approved applications to submit.');
    process.exit(0);
  }

  console.log(`[submit] ${approved.length} approved applications to submit${dryRun ? ' (DRY RUN)' : ''}...\n`);

  const engine = new JobApplicationEngine({
    firstName: 'Aditya',
    lastName: 'Sugandhi',
    email: 'adityasugandhi.dev.ai@gmail.com',
    phone: '+1 448 500 6857',
    githubUrl: 'https://github.com/adityasugandhi',
    websiteUrl: 'https://adityasugandhi.com',
    linkedinUrl: 'https://www.linkedin.com/in/adityasugandhi/',
  });

  const submissionResults: SubmissionSummary['results'] = [];
  let submitted = 0;
  let failed = 0;

  for (let i = 0; i < approved.length; i++) {
    const app = approved[i];
    console.log(`[submit] (${i + 1}/${approved.length}) ${app.company} — ${app.jobTitle}`);

    let lastError = '';
    let success = false;

    // Retry logic: 2 retries with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await engine.apply(
          app.url, // jobId derived from URL
          app.company,
          {
            dryRun,
            ...(app.tailoredResumePath ? {} : {}),
          }
        );

        if (result.success) {
          success = true;
          await queue.updateStatus(app.id, 'submitted');
          if (!dryRun) {
            await tracker.track(result, app.jobTitle, app.url);
          }
          submitted++;
          console.log(`  ✓ ${dryRun ? 'DRY RUN' : 'Submitted'} successfully`);
          break;
        } else {
          lastError = result.error || 'Unknown error';
          if (attempt < 2) {
            const backoff = (attempt + 1) * 5000;
            console.log(`  ⚠ Attempt ${attempt + 1} failed: ${lastError}. Retrying in ${backoff / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, backoff));
          }
        }
      } catch (error) {
        lastError = (error as Error).message;
        if (attempt < 2) {
          const backoff = (attempt + 1) * 5000;
          console.log(`  ⚠ Attempt ${attempt + 1} error: ${lastError}. Retrying in ${backoff / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    if (!success) {
      await queue.updateStatus(app.id, 'failed', lastError);
      failed++;
      console.log(`  ✗ Failed: ${lastError}`);
    }

    submissionResults.push({
      company: app.company,
      role: app.jobTitle,
      status: success ? 'submitted' : 'failed',
      error: success ? undefined : lastError,
    });

    // Human-like delay between submissions (5-12s)
    if (i < approved.length - 1) {
      await randomDelay(5000, 12000);
    }
  }

  const summary: SubmissionSummary = { submitted, failed, results: submissionResults };
  console.log(`\n[submit] Done: ${submitted} submitted, ${failed} failed`);

  await notifier.sendSubmissionSummary(summary);
}

main().catch((error) => {
  console.error('[submit] Fatal error:', error);
  process.exit(1);
});
