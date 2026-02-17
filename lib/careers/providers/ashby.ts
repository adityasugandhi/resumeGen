import { CareerJob } from '@/lib/careers/types';

interface AshbyJob {
  id: string;
  title: string;
  location: string;
  department: string;
  publishedAt: string;
  jobUrl: string;
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

export async function listAshbyJobs(
  boardToken: string,
  company: string,
  query?: string,
  location?: string
): Promise<CareerJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${boardToken}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Ashby API error: ${response.status}`);
  const data: AshbyResponse = await response.json();

  let jobs = data.jobs.map(job => ({
    id: job.id,
    title: job.title,
    location: job.location || 'Remote',
    team: job.department || '',
    url: job.jobUrl,
    company,
    platform: 'ashby' as const,
    updatedAt: new Date(job.publishedAt).getTime(),
  }));

  if (query) {
    const q = query.toLowerCase();
    jobs = jobs.filter(j => j.title.toLowerCase().includes(q) || j.team.toLowerCase().includes(q));
  }
  if (location) {
    const loc = location.toLowerCase();
    jobs = jobs.filter(j => j.location.toLowerCase().includes(loc));
  }

  return jobs;
}
