import cron from 'node-cron';
import { CronOrchestrator } from '../lib/cron/orchestrator';
import { loadCronConfig } from '../lib/cron/cron-config';

async function main() {
  const args = process.argv.slice(2);
  const runOnce = args.includes('--once');
  const config = loadCronConfig();
  const orchestrator = new CronOrchestrator(config);

  if (runOnce) {
    console.log('[cron] Running once...');
    const summary = await orchestrator.runOnce();
    console.log('[cron] Done.', JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  console.log(`[cron] Scheduling job search at: ${config.cronSchedule}`);
  console.log(`[cron] Titles: ${config.jobTitles.join(', ')}`);
  console.log(`[cron] Location: ${config.location}`);
  console.log(`[cron] Match threshold: ${config.matchThreshold}%`);
  console.log(`[cron] Daily limit: ${config.dailyApplicationLimit}`);
  console.log(`[cron] Slack: ${config.slack.webhookUrl ? 'configured' : 'not configured'}`);

  cron.schedule(config.cronSchedule, async () => {
    console.log(`\n[cron] Starting scheduled run at ${new Date().toISOString()}`);
    try {
      await orchestrator.runOnce();
    } catch (error) {
      console.error('[cron] Scheduled run failed:', (error as Error).message);
    }
  });

  console.log('[cron] Scheduler running. Press Ctrl+C to stop.');
}

main().catch((error) => {
  console.error('[cron] Fatal error:', error);
  process.exit(1);
});
