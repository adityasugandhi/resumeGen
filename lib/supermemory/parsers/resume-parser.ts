/**
 * Master Resume Parser
 *
 * Parses resume content (LaTeX, plain text, or structured data) into
 * semantic components for storage in SuperMemory.
 *
 * Extracts:
 * - Work experiences
 * - Skills (technical, soft, tools, languages)
 * - Projects
 * - Education
 * - Summary/objective
 */

import type {
  MasterResume,
  ResumeExperience,
  ResumeProject,
  ResumeEducation,
} from '@/lib/indexeddb';
import type { ResumeComponentMetadata } from '../types';

// ============================================
// Resume Parsing Types
// ============================================

export interface ParsedResumeComponent {
  content: string;
  metadata: Omit<ResumeComponentMetadata, 'type' | 'userId' | 'createdAt'>;
}

export interface ParsedResume {
  components: ParsedResumeComponent[];
  summary: string;
}

// ============================================
// Main Parser
// ============================================

/**
 * Parse master resume into SuperMemory-compatible components
 */
export function parseMasterResume(masterResume: MasterResume): ParsedResume {
  const components: ParsedResumeComponent[] = [];

  // Parse experiences
  if (masterResume.experiences && masterResume.experiences.length > 0) {
    for (const experience of masterResume.experiences) {
      components.push(parseExperience(experience));
    }
  }

  // Parse skills
  if (masterResume.skills) {
    components.push(parseSkills(masterResume.skills));
  }

  // Parse projects
  if (masterResume.projects && masterResume.projects.length > 0) {
    for (const project of masterResume.projects) {
      components.push(parseProject(project));
    }
  }

  // Parse education
  if (masterResume.education && masterResume.education.length > 0) {
    for (const edu of masterResume.education) {
      components.push(parseEducation(edu));
    }
  }

  // Summary
  const summary = generateSummary(masterResume);

  return {
    components,
    summary,
  };
}

// ============================================
// Component Parsers
// ============================================

/**
 * Parse a single work experience
 */
function parseExperience(experience: ResumeExperience): ParsedResumeComponent {
  const years = `${experience.startDate}${experience.endDate ? ` - ${experience.endDate}` : ' - Present'}`;

  const content = `
**${experience.title}** at **${experience.company}**
${years}

${experience.bullets.map(bullet => `• ${bullet}`).join('\n')}
  `.trim();

  // Extract technologies/keywords from bullets
  const keywords = extractKeywords(experience.bullets.join(' '));

  return {
    content,
    metadata: {
      componentType: 'experience',
      componentId: experience.id,
      title: experience.title,
      company: experience.company,
      years,
      technologies: keywords.technologies,
      keywords: [experience.company, experience.title, ...keywords.technologies],
    },
  };
}

/**
 * Parse skills section
 */
function parseSkills(skills: MasterResume['skills']): ParsedResumeComponent {
  const content = `
**Technical Skills**
${skills.technical.map(s => `• ${s}`).join('\n')}

**Tools & Technologies**
${skills.tools.map(s => `• ${s}`).join('\n')}

**Soft Skills**
${skills.soft.map(s => `• ${s}`).join('\n')}

${skills.languages && skills.languages.length > 0 ? `**Languages**\n${skills.languages.map(s => `• ${s}`).join('\n')}` : ''}
  `.trim();

  return {
    content,
    metadata: {
      componentType: 'skill',
      componentId: 'skills-master',
      technologies: [...skills.technical, ...skills.tools],
      keywords: [
        ...skills.technical,
        ...skills.tools,
        ...skills.soft,
        ...(skills.languages || []),
      ],
    },
  };
}

/**
 * Parse a single project
 */
function parseProject(project: ResumeProject): ParsedResumeComponent {
  const content = `
**${project.name}**

${project.description}

**Technologies**: ${project.technologies.join(', ')}

${project.bullets.map(bullet => `• ${bullet}`).join('\n')}
  `.trim();

  return {
    content,
    metadata: {
      componentType: 'project',
      componentId: project.id,
      title: project.name,
      technologies: project.technologies,
      keywords: [project.name, ...project.technologies],
    },
  };
}

/**
 * Parse education entry
 */
function parseEducation(education: ResumeEducation): ParsedResumeComponent {
  const content = `
**${education.degree}** in **${education.field}**
${education.institution}
Graduated: ${education.graduationDate}
  `.trim();

  return {
    content,
    metadata: {
      componentType: 'education',
      componentId: education.id,
      title: education.degree,
      keywords: [
        education.institution,
        education.degree,
        education.field,
      ],
    },
  };
}

// ============================================
// Keyword Extraction
// ============================================

const COMMON_TECHNOLOGIES = [
  // Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
  // Frontend
  'react', 'vue', 'angular', 'nextjs', 'next.js', 'svelte', 'html', 'css', 'sass', 'tailwind',
  // Backend
  'node', 'nodejs', 'express', 'fastapi', 'django', 'flask', 'spring', 'laravel', '.net',
  // Databases
  'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'dynamodb', 'firebase', 'supabase',
  // Cloud/DevOps
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform', 'ci/cd', 'jenkins', 'github actions',
  // Tools
  'git', 'jira', 'figma', 'webpack', 'vite', 'babel', 'eslint', 'jest', 'cypress', 'playwright',
  // Other
  'rest', 'graphql', 'grpc', 'websocket', 'api', 'microservices', 'serverless', 'machine learning', 'ml', 'ai',
];

/**
 * Extract technology keywords from text
 */
function extractKeywords(text: string): { technologies: string[] } {
  const lowerText = text.toLowerCase();
  const found = new Set<string>();

  for (const tech of COMMON_TECHNOLOGIES) {
    if (lowerText.includes(tech)) {
      found.add(tech);
    }
  }

  return {
    technologies: Array.from(found),
  };
}

// ============================================
// Summary Generation
// ============================================

/**
 * Generate a concise summary of the resume for context
 */
function generateSummary(masterResume: MasterResume): string {
  const yearsOfExp = calculateYearsOfExperience(masterResume.experiences);
  const topSkills = masterResume.skills?.technical.slice(0, 5).join(', ') || 'various technologies';
  const companies = masterResume.experiences.map(e => e.company).slice(0, 3);
  const degrees = masterResume.education?.map(e => e.degree) || [];

  let summary = '';

  if (masterResume.summary) {
    summary = masterResume.summary;
  } else {
    summary = `Professional with ${yearsOfExp} years of experience`;
    if (companies.length > 0) {
      summary += `, having worked at ${companies.join(', ')}`;
    }
    summary += `. Skilled in ${topSkills}.`;
    if (degrees.length > 0) {
      summary += ` Education: ${degrees.join(', ')}.`;
    }
  }

  return summary;
}

/**
 * Calculate total years of professional experience
 */
function calculateYearsOfExperience(experiences: ResumeExperience[]): number {
  if (!experiences || experiences.length === 0) {
    return 0;
  }

  const now = new Date();
  let totalMonths = 0;

  for (const exp of experiences) {
    const start = parseDate(exp.startDate);
    const end = exp.endDate ? parseDate(exp.endDate) : now;

    if (start && end) {
      const months = (end.getFullYear() - start.getFullYear()) * 12 +
                     (end.getMonth() - start.getMonth());
      totalMonths += Math.max(0, months);
    }
  }

  return Math.floor(totalMonths / 12);
}

/**
 * Parse date string (handles various formats)
 */
function parseDate(dateStr: string): Date | null {
  // Try parsing common formats
  const formats = [
    // YYYY-MM
    /^(\d{4})-(\d{2})$/,
    // YYYY/MM
    /^(\d{4})\/(\d{2})$/,
    // MM/YYYY
    /^(\d{2})\/(\d{4})$/,
    // Month YYYY (e.g., "January 2020")
    /^(\w+)\s+(\d{4})$/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format.source.includes('(\\w+)')) {
        // Month name format
        const monthStr = match[1];
        const year = parseInt(match[2], 10);
        const month = parseMonthName(monthStr);
        if (month !== null) {
          return new Date(year, month);
        }
      } else if (format.source.includes('(\\d{2})/(\\d{4})')) {
        // MM/YYYY format
        const month = parseInt(match[1], 10) - 1;
        const year = parseInt(match[2], 10);
        return new Date(year, month);
      } else {
        // YYYY-MM or YYYY/MM format
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        return new Date(year, month);
      }
    }
  }

  return null;
}

/**
 * Parse month name to number (0-11)
 */
function parseMonthName(monthStr: string): number | null {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];

  const index = months.indexOf(monthStr.toLowerCase());
  return index >= 0 ? index : null;
}

// ============================================
// LaTeX Parsing (Bonus Feature)
// ============================================

/**
 * Extract text content from LaTeX resume
 * (Simple version - removes LaTeX commands)
 */
export function extractTextFromLatex(latex: string): string {
  let text = latex;

  // Remove comments
  text = text.replace(/%.*$/gm, '');

  // Remove common commands
  text = text.replace(/\\(documentclass|usepackage|newcommand|renewcommand)\{[^}]*\}/g, '');
  text = text.replace(/\\(begin|end)\{[^}]*\}/g, '');

  // Remove formatting commands but keep content
  text = text.replace(/\\(textbf|textit|emph|large|Large|LARGE|small|footnotesize)\{([^}]*)\}/g, '$2');

  // Remove special characters
  text = text.replace(/\\[&%$#_{}]/g, '');

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}
