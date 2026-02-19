import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface CronConfig {
  cronSchedule: string;
  jobTitles: string[];
  location: string;
  maxJobsPerTitle: number;
  matchThreshold: number;
  dailyApplicationLimit: number;
  slack: {
    webhookUrl: string;
  };
  autoApprove: boolean;
}

const DEFAULT_CONFIG: CronConfig = {
  cronSchedule: '0 8 * * *',
  jobTitles: ['Software Engineer', 'Full Stack Engineer', 'Frontend Engineer'],
  location: 'United States',
  maxJobsPerTitle: 5,
  matchThreshold: 60,
  dailyApplicationLimit: 25,
  slack: {
    webhookUrl: '',
  },
  autoApprove: false,
};

const CONFIG_PATH = join(process.cwd(), '.cron-config.json');

export function loadCronConfig(): CronConfig {
  let fileConfig: Partial<CronConfig> = {};

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch (error) {
      console.warn('[cron-config] Failed to parse .cron-config.json:', (error as Error).message);
    }
  }

  const config: CronConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    slack: {
      ...DEFAULT_CONFIG.slack,
      ...(fileConfig.slack || {}),
    },
  };

  // Environment variable overrides
  if (process.env.CRON_SCHEDULE) {
    config.cronSchedule = process.env.CRON_SCHEDULE;
  }
  if (process.env.SLACK_WEBHOOK_URL) {
    config.slack.webhookUrl = process.env.SLACK_WEBHOOK_URL;
  }
  if (process.env.CRON_MATCH_THRESHOLD) {
    config.matchThreshold = parseInt(process.env.CRON_MATCH_THRESHOLD, 10);
  }
  if (process.env.CRON_DAILY_LIMIT) {
    config.dailyApplicationLimit = parseInt(process.env.CRON_DAILY_LIMIT, 10);
  }
  if (process.env.CRON_AUTO_APPROVE === 'true') {
    config.autoApprove = true;
  }

  return config;
}
