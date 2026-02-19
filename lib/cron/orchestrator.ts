import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { loadCronConfig, type CronConfig } from './cron-config';
import { ApplicationQueue } from './application-queue';
import { SlackNotifier, type DailySummary } from './slack-notifier';
import { PersistentTracker } from '@/lib/careers/auto-apply/tracker';
import { runJobSearchAgent } from '@/lib/ai/agent/job-search-agent';
import type { AgentStepEvent, AgentJobResult } from '@/lib/ai/agent/types';

interface SelfEvolutionEntry {
  timestamp: string;
  type: 'code_fix' | 'new_provider';
  tool?: string;
  filesModified: string[];
  summary: string;
}

const EVOLUTION_LOG_PATH = join(process.cwd(), 'Job_Applications/tracker/self-evolution-log.json');

function appendEvolutionLog(entry: SelfEvolutionEntry): void {
  const dir = dirname(EVOLUTION_LOG_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let log: SelfEvolutionEntry[] = [];
  if (existsSync(EVOLUTION_LOG_PATH)) {
    try {
      log = JSON.parse(readFileSync(EVOLUTION_LOG_PATH, 'utf-8'));
    } catch { /* start fresh */ }
  }
  log.push(entry);
  writeFileSync(EVOLUTION_LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');
}

export class CronOrchestrator {
  private config: CronConfig;
  private queue: ApplicationQueue;
  private tracker: PersistentTracker;
  private notifier: SlackNotifier;

  constructor(config?: CronConfig) {
    this.config = config || loadCronConfig();
    this.queue = new ApplicationQueue();
    this.tracker = new PersistentTracker();
    this.notifier = new SlackNotifier(this.config.slack.webhookUrl);
  }

  async runOnce(): Promise<DailySummary> {
    const summary: DailySummary = {
      titlesSearched: [],
      jobsFound: 0,
      matchesAboveThreshold: 0,
      queuedCount: 0,
      selfEvolutionActions: [],
      date: new Date().toISOString().split('T')[0],
    };

    let totalQueued = 0;

    for (const jobTitle of this.config.jobTitles) {
      if (totalQueued >= this.config.dailyApplicationLimit) {
        console.log(`[cron] Daily limit reached (${this.config.dailyApplicationLimit}), stopping`);
        break;
      }

      console.log(`\n[cron] Searching: "${jobTitle}"...`);
      summary.titlesSearched.push(jobTitle);

      const selfEvolutionActions: { tool: string; summary: string }[] = [];

      const onEvent = (event: AgentStepEvent) => {
        switch (event.type) {
          case 'code_fix':
            const fixEntry: SelfEvolutionEntry = {
              timestamp: new Date().toISOString(),
              type: 'code_fix',
              filesModified: event.filesModified,
              summary: event.summary,
            };
            appendEvolutionLog(fixEntry);
            selfEvolutionActions.push({ tool: 'code_fix', summary: event.summary });
            this.notifier.sendSelfEvolutionAlert({
              tool: 'code_fix',
              filesModified: event.filesModified,
              summary: event.summary,
            });
            break;
          case 'new_provider':
            const providerEntry: SelfEvolutionEntry = {
              timestamp: new Date().toISOString(),
              type: 'new_provider',
              filesModified: [],
              summary: `New provider created for ${event.company} (${event.platform})`,
            };
            appendEvolutionLog(providerEntry);
            selfEvolutionActions.push({
              tool: 'new_provider',
              summary: `Created provider for ${event.company}`,
            });
            this.notifier.sendSelfEvolutionAlert({
              tool: 'new_provider',
              filesModified: [],
              summary: `New provider created for ${event.company} (${event.platform})`,
            });
            break;
          case 'jobs_found':
            console.log(`  [cron] Found ${event.count} jobs at ${event.company}`);
            break;
          case 'matched':
            console.log(`  [cron] Match score: ${event.score}%`);
            break;
          case 'self_healing':
            console.log(`  [cron] Self-healing: ${event.message}`);
            break;
        }
      };

      try {
        const response = await runJobSearchAgent(jobTitle, this.config.location, {
          maxJobs: this.config.maxJobsPerTitle,
          matchThreshold: this.config.matchThreshold,
          onEvent,
        });

        summary.jobsFound += response.results.length;
        summary.selfEvolutionActions.push(...selfEvolutionActions);

        // Filter, deduplicate, and queue
        for (const result of response.results) {
          if (totalQueued >= this.config.dailyApplicationLimit) break;

          if (result.matchScore < this.config.matchThreshold) continue;
          summary.matchesAboveThreshold++;

          if (!result.url) continue;
          if (await this.tracker.hasApplied(result.url)) {
            console.log(`  [cron] Skipping (already applied): ${result.company} - ${result.title}`);
            continue;
          }
          if (await this.queue.hasUrl(result.url)) {
            console.log(`  [cron] Skipping (already queued): ${result.company} - ${result.title}`);
            continue;
          }

          const queued = await this.queue.add({
            jobTitle: result.title,
            company: result.company,
            url: result.url,
            location: result.location || '',
            matchScore: result.matchScore,
            gaps: result.gaps || [],
            strengths: result.strengths || [],
            tailoredResumePath: this.getResumePath(result),
            tailoredPdfPath: this.getPdfPath(result),
          });

          if (queued.status === 'pending') {
            totalQueued++;
            summary.queuedCount++;
            console.log(`  [cron] Queued: ${result.company} - ${result.title} (${result.matchScore}%)`);
          }
        }
      } catch (error) {
        console.error(`[cron] Error searching "${jobTitle}":`, (error as Error).message);
        summary.selfEvolutionActions.push({
          tool: 'agent_error',
          summary: `Failed to search "${jobTitle}": ${(error as Error).message}`,
        });
      }
    }

    // Send Slack summary
    await this.notifier.sendDailySummary(summary);

    console.log(`\n[cron] Summary: ${summary.jobsFound} found, ${summary.matchesAboveThreshold} above threshold, ${summary.queuedCount} queued`);
    return summary;
  }

  private getResumePath(result: AgentJobResult): string {
    if (result.optimizedResume?.latex) {
      const safeCompany = result.company.replace(/[^a-zA-Z0-9]/g, '_');
      const dir = join(process.cwd(), `Job_Applications/Companies/${safeCompany}`);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const texPath = join(dir, `${safeCompany}_resume.tex`);
      writeFileSync(texPath, result.optimizedResume.latex, 'utf-8');
      return texPath;
    }
    return '';
  }

  private getPdfPath(result: AgentJobResult): string {
    if (result.optimizedResume?.latex) {
      const safeCompany = result.company.replace(/[^a-zA-Z0-9]/g, '_');
      return join(process.cwd(), `Job_Applications/Companies/${safeCompany}/${safeCompany}_resume.pdf`);
    }
    return '';
  }
}
