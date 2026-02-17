import { CareerJob } from '@/lib/careers/types';

interface LeverPosting {
  id: string;
  text: string;
  createdAt: number;
  categories: { location?: string; team?: string; department?: string };
  hostedUrl: string;
}

export async function listLeverJobs(
  company: string,
  query?: string,
  location?: string
): Promise<CareerJob[]> {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Lever API error: ${response.status}`);
  const data: LeverPosting[] = await response.json();

  let jobs = data.map(posting => ({
    id: posting.id,
    title: posting.text,
    location: posting.categories?.location || 'Remote',
    team: posting.categories?.team || posting.categories?.department || '',
    url: posting.hostedUrl,
    company,
    platform: 'lever' as const,
    updatedAt: posting.createdAt,
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
