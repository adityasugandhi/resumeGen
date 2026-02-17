import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Selects the best resume file for a given company and role.
 * Looks in Job_Applications/ folder for tailored resumes matching {Company}_{Role}.pdf
 * Falls back to master resume.
 */
export function selectResume(
  company: string,
  role?: string,
  basePath: string = process.cwd()
): string {
  const applicationsDir = join(basePath, 'Job_Applications');

  // If the applications directory doesn't exist, return master template
  if (!existsSync(applicationsDir)) {
    return getMasterResumePath(basePath);
  }

  const files = readdirSync(applicationsDir).filter((f) => f.endsWith('.pdf'));
  const companyLower = company.toLowerCase().replace(/\s+/g, '');

  // Try exact match: Company_Role.pdf
  if (role) {
    const roleLower = role.toLowerCase().replace(/\s+/g, '');
    const exactMatch = files.find((f) => {
      const fLower = f.toLowerCase().replace(/\s+/g, '');
      return fLower.includes(companyLower) && fLower.includes(roleLower);
    });
    if (exactMatch) return join(applicationsDir, exactMatch);
  }

  // Try company match: Company_*.pdf
  const companyMatch = files.find((f) =>
    f.toLowerCase().replace(/\s+/g, '').includes(companyLower)
  );
  if (companyMatch) return join(applicationsDir, companyMatch);

  // Try most recently modified PDF
  if (files.length > 0) {
    const sorted = files
      .map((f) => ({ name: f, path: join(applicationsDir, f) }))
      .sort((a, b) => {
        return statSync(b.path).mtimeMs - statSync(a.path).mtimeMs;
      });
    return sorted[0].path;
  }

  return getMasterResumePath(basePath);
}

function getMasterResumePath(basePath: string): string {
  const candidates = [
    join(basePath, 'master-template.pdf'),
    join(basePath, 'resume.pdf'),
    join(basePath, 'Resume.pdf'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return join(basePath, 'master-template.pdf');
}
