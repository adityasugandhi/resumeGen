export interface DailySummary {
  titlesSearched: string[];
  jobsFound: number;
  matchesAboveThreshold: number;
  queuedCount: number;
  selfEvolutionActions: { tool: string; summary: string }[];
  date: string;
}

export interface SubmissionSummary {
  submitted: number;
  failed: number;
  results: { company: string; role: string; status: string; error?: string }[];
}

export class SlackNotifier {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  private async send(payload: Record<string, unknown>): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('[slack] No webhook URL configured, skipping notification');
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error('[slack] Webhook failed:', response.status, await response.text());
        return false;
      }
      return true;
    } catch (error) {
      console.error('[slack] Webhook error:', (error as Error).message);
      return false;
    }
  }

  async sendDailySummary(summary: DailySummary): Promise<boolean> {
    const selfHealText = summary.selfEvolutionActions.length > 0
      ? summary.selfEvolutionActions.map((a) => `• \`${a.tool}\`: ${a.summary}`).join('\n')
      : '_None_';

    return this.send({
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `Job Search Summary — ${summary.date}` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Titles Searched:*\n${summary.titlesSearched.join(', ')}` },
            { type: 'mrkdwn', text: `*Jobs Found:* ${summary.jobsFound}` },
            { type: 'mrkdwn', text: `*Above Threshold:* ${summary.matchesAboveThreshold}` },
            { type: 'mrkdwn', text: `*Queued for Review:* ${summary.queuedCount}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Self-Evolution Actions:*\n${selfHealText}` },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: 'Run `npm run queue:list` to review pending applications' },
          ],
        },
      ],
    });
  }

  async sendSelfEvolutionAlert(action: { tool: string; filesModified: string[]; summary: string }): Promise<boolean> {
    return this.send({
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'Self-Evolution Alert' },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Tool:* \`${action.tool}\`` },
            { type: 'mrkdwn', text: `*Files Modified:* ${action.filesModified.length}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Summary:*\n${action.summary}` },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Files:*\n${action.filesModified.map((f) => `• \`${f}\``).join('\n')}`,
          },
        },
      ],
    });
  }

  async sendSubmissionSummary(summary: SubmissionSummary): Promise<boolean> {
    const resultLines = summary.results.map((r) => {
      const icon = r.status === 'submitted' ? ':white_check_mark:' : ':x:';
      const errorSuffix = r.error ? ` — ${r.error}` : '';
      return `${icon} *${r.company}* — ${r.role}${errorSuffix}`;
    });

    return this.send({
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'Application Submission Results' },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Submitted:* ${summary.submitted}` },
            { type: 'mrkdwn', text: `*Failed:* ${summary.failed}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: resultLines.join('\n') },
        },
      ],
    });
  }
}
