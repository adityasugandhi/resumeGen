import { CareerJob } from '@/lib/careers/types';

/** Cloudflare-specific metadata IDs used by their careers frontend. */
const META_DEPARTMENT = 46546702;
const META_LOCATION = 8654220;

interface GreenhouseMetadata {
  id: number;
  name: string;
  value: string | string[] | null;
  value_type: string;
}

interface GreenhouseJobRaw {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  location: { name: string };
  metadata: GreenhouseMetadata[];
}

interface DepartmentNode {
  id: number;
  name: string;
  jobs: GreenhouseJobRaw[];
  children: DepartmentNode[];
}

interface DepartmentsTreeResponse {
  departments: DepartmentNode[];
}

/**
 * Fetch Cloudflare jobs using the departments tree endpoint — the same
 * call their own frontend makes. This gives us richer metadata for
 * department and location filtering than the generic Greenhouse /jobs endpoint.
 */
export async function listCloudflareJobs(
  query?: string,
  location?: string,
  department?: string,
): Promise<CareerJob[]> {
  const url = 'https://boards-api.greenhouse.io/v1/boards/cloudflare/departments/?render_as=tree';
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Cloudflare/Greenhouse API error: ${response.status}`);
  }

  const data: DepartmentsTreeResponse = await response.json();

  // Flatten all jobs from the department tree
  const rawJobs = flattenDepartments(data.departments);

  // Map to CareerJob using metadata for accurate department/location
  let jobs: CareerJob[] = rawJobs
    .filter((job) => getMetaValues(job, META_DEPARTMENT).length > 0)
    .map((job) => ({
      id: String(job.id),
      title: job.title,
      location: getMetaValues(job, META_LOCATION).join(', ') || job.location?.name || 'Remote',
      team: getMetaValues(job, META_DEPARTMENT).join(', '),
      url: job.absolute_url,
      company: 'Cloudflare',
      platform: 'cloudflare' as const,
      updatedAt: new Date(job.updated_at).getTime(),
    }));

  // Apply filters
  if (query) {
    const q = query.toLowerCase();
    jobs = jobs.filter(
      (j) => j.title.toLowerCase().includes(q) || j.team.toLowerCase().includes(q),
    );
  }

  if (location) {
    const loc = location.toLowerCase();
    jobs = jobs.filter((j) => j.location.toLowerCase().includes(loc));
  }

  if (department) {
    const dept = department.toLowerCase();
    jobs = jobs.filter((j) => j.team.toLowerCase().includes(dept));
  }

  return jobs;
}

/** Recursively collect all jobs from the department tree. */
function flattenDepartments(departments: DepartmentNode[]): GreenhouseJobRaw[] {
  const jobs: GreenhouseJobRaw[] = [];

  for (const dept of departments) {
    jobs.push(...dept.jobs);
    if (dept.children?.length) {
      jobs.push(...flattenDepartments(dept.children));
    }
  }

  return jobs;
}

/** Extract metadata values as a string array for a given metadata ID. */
function getMetaValues(job: GreenhouseJobRaw, metaId: number): string[] {
  const meta = job.metadata?.find((m) => m.id === metaId);
  if (!meta?.value) return [];
  return Array.isArray(meta.value) ? meta.value : [meta.value];
}
