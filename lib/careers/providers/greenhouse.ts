import { CareerJob } from '@/lib/careers/types';

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  location: { name: string };
  departments: { name: string }[];
  absolute_url: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export async function listGreenhouseJobs(
  boardToken: string,
  company: string,
  query?: string,
  location?: string
): Promise<CareerJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Greenhouse API error: ${response.status}`);
  const data: GreenhouseResponse = await response.json();

  let jobs = data.jobs.map(job => ({
    id: String(job.id),
    title: job.title,
    location: job.location?.name || 'Remote',
    team: job.departments?.[0]?.name || '',
    url: job.absolute_url,
    company,
    platform: 'greenhouse' as const,
    updatedAt: new Date(job.updated_at).getTime(),
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
