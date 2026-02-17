/**
 * SuperMemory Sync Logic
 *
 * Handles synchronization between IndexedDB (local storage) and SuperMemory (cloud memory).
 * - One-way sync: IndexedDB → SuperMemory
 * - Batch operations for efficiency
 * - Progress tracking and error handling
 */

import {
  getAllJobs,
  getAllResumeVersions,
  getMasterResume,
  type JobPosting,
  type ResumeVersion,
  type ResumeExperience,
  type ResumeProject,
} from '@/lib/indexeddb';
import {
  memoryService,
  jobPostingService,
  resumeComponentService,
  resumeVersionService,
} from './service';
import type {
  SyncResult,
  SyncOperation,
  JobPostingMetadata,
  ResumeVersionMetadata,
  ResumeComponentMetadata,
  MemoryType,
} from './types';

// ============================================
// Sync Configuration
// ============================================

const BATCH_SIZE = 10; // Process items in batches to avoid overwhelming the API
const RETRY_DELAY_MS = 1000; // 1 second delay between retries

// ============================================
// Sync Operations
// ============================================

/**
 * Sync all IndexedDB data to SuperMemory
 */
export async function syncAll(userId: string): Promise<SyncResult> {
  const startTime = Date.now();
  const operations: SyncOperation[] = [];


  try {
    // Step 1: Sync master resume
    const masterResumeOps = await syncMasterResume(userId);
    operations.push(...masterResumeOps);

    // Step 2: Sync job postings
    const jobOps = await syncJobs(userId);
    operations.push(...jobOps);

    // Step 3: Sync resume versions
    const versionOps = await syncResumeVersions(userId);
    operations.push(...versionOps);

    // Calculate results
    const completed = operations.filter(op => op.status === 'completed').length;
    const failed = operations.filter(op => op.status === 'failed').length;
    const errors = operations
      .filter(op => op.status === 'failed')
      .map(op => ({ operation: op, error: op.error || 'Unknown error' }));

    const duration = Date.now() - startTime;

    return {
      success: failed === 0,
      operationsCompleted: completed,
      operationsFailed: failed,
      errors,
      duration,
    };
  } catch (error) {
    console.error('[Sync] Fatal error during sync:', error);
    return {
      success: false,
      operationsCompleted: 0,
      operationsFailed: operations.length,
      errors: [{ operation: operations[0], error: String(error) }],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Sync master resume to SuperMemory (parse into components)
 */
async function syncMasterResume(userId: string): Promise<SyncOperation[]> {
  const operations: SyncOperation[] = [];

  try {
    const masterResume = await getMasterResume(userId);
    if (!masterResume) {
      return operations;
    }


    // Sync each experience
    for (const experience of masterResume.experiences) {
      const operation = createOperation('add', 'resume_component');
      operations.push(operation);

      try {
        const content = formatExperienceContent(experience);
        const metadata: Omit<ResumeComponentMetadata, 'type' | 'userId' | 'createdAt'> = {
          componentType: 'experience',
          componentId: experience.id,
          title: experience.title,
          company: experience.company,
          years: `${experience.startDate} - ${experience.endDate || 'Present'}`,
          keywords: [experience.company, experience.title],
        };

        await resumeComponentService.add(userId, content, metadata);
        completeOperation(operation);
      } catch (error) {
        failOperation(operation, error);
      }
    }

    // Sync skills
    if (masterResume.skills) {
      const operation = createOperation('add', 'resume_component');
      operations.push(operation);

      try {
        const content = formatSkillsContent(masterResume.skills);
        const metadata: Omit<ResumeComponentMetadata, 'type' | 'userId' | 'createdAt'> = {
          componentType: 'skill',
          componentId: 'skills-all',
          keywords: [
            ...masterResume.skills.technical,
            ...masterResume.skills.tools,
          ],
        };

        await resumeComponentService.add(userId, content, metadata);
        completeOperation(operation);
      } catch (error) {
        failOperation(operation, error);
      }
    }

    // Sync projects
    if (masterResume.projects) {
      for (const project of masterResume.projects) {
        const operation = createOperation('add', 'resume_component');
        operations.push(operation);

        try {
          const content = formatProjectContent(project);
          const metadata: Omit<ResumeComponentMetadata, 'type' | 'userId' | 'createdAt'> = {
            componentType: 'project',
            componentId: project.id,
            title: project.name,
            technologies: project.technologies,
            keywords: [project.name, ...project.technologies],
          };

          await resumeComponentService.add(userId, content, metadata);
          completeOperation(operation);
        } catch (error) {
          failOperation(operation, error);
        }
      }
    }

  } catch (error) {
    console.error('[Sync] Error syncing master resume:', error);
  }

  return operations;
}

/**
 * Sync job postings to SuperMemory
 */
async function syncJobs(userId: string): Promise<SyncOperation[]> {
  const operations: SyncOperation[] = [];

  try {
    const jobs = await getAllJobs();

    // Process in batches
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);

      for (const job of batch) {
        const operation = createOperation('add', 'job_posting');
        operations.push(operation);

        try {
          const content = formatJobContent(job);
          const metadata: Omit<JobPostingMetadata, 'type' | 'userId' | 'createdAt'> = {
            jobId: job.id,
            jobTitle: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            employmentType: job.employmentType,
            url: job.url,
            status: job.status,
            scannedAt: job.createdAt,
            technologies: extractTechnologies(job.requirements),
          };

          await jobPostingService.add(userId, content, metadata);
          completeOperation(operation);
        } catch (error) {
          failOperation(operation, error);
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < jobs.length) {
        await delay(RETRY_DELAY_MS);
      }
    }

  } catch (error) {
    console.error('[Sync] Error syncing jobs:', error);
  }

  return operations;
}

/**
 * Sync resume versions to SuperMemory
 */
async function syncResumeVersions(userId: string): Promise<SyncOperation[]> {
  const operations: SyncOperation[] = [];

  try {
    const versions = await getAllResumeVersions();

    // Process in batches
    for (let i = 0; i < versions.length; i += BATCH_SIZE) {
      const batch = versions.slice(i, i + BATCH_SIZE);

      for (const version of batch) {
        const operation = createOperation('add', 'resume_version');
        operations.push(operation);

        try {
          const content = formatResumeVersionContent(version);
          const metadata: Omit<ResumeVersionMetadata, 'type' | 'userId' | 'createdAt'> = {
            versionId: version.id,
            jobId: version.jobId,
            overallMatchScore: version.overallMatchScore,
            changesCount: version.changes.length,
            acceptedChangesCount: version.acceptedChanges?.length || 0,
            optimizedAt: version.createdAt,
            wasAccepted: (version.acceptedChanges?.length || 0) > 0,
          };

          await resumeVersionService.add(userId, content, metadata);
          completeOperation(operation);
        } catch (error) {
          failOperation(operation, error);
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < versions.length) {
        await delay(RETRY_DELAY_MS);
      }
    }

  } catch (error) {
    console.error('[Sync] Error syncing resume versions:', error);
  }

  return operations;
}

// ============================================
// Formatting Helpers
// ============================================

function formatExperienceContent(experience: ResumeExperience): string {
  return `
**${experience.title}** at **${experience.company}**
${experience.startDate} - ${experience.endDate || 'Present'}

${experience.bullets.map((b: string) => `- ${b}`).join('\n')}
  `.trim();
}

interface SkillsData {
  technical: string[];
  tools: string[];
  soft: string[];
  languages: string[];
}

function formatSkillsContent(skills: SkillsData): string {
  return `
**Technical Skills**: ${skills.technical.join(', ')}
**Tools**: ${skills.tools.join(', ')}
**Soft Skills**: ${skills.soft.join(', ')}
**Languages**: ${skills.languages.join(', ')}
  `.trim();
}

function formatProjectContent(project: ResumeProject): string {
  return `
**${project.name}**
${project.description}

**Technologies**: ${project.technologies.join(', ')}

${project.bullets.map((b: string) => `- ${b}`).join('\n')}
  `.trim();
}

function formatJobContent(job: JobPosting): string {
  return `
# ${job.title} at ${job.company}

**Location**: ${job.location || 'Not specified'}
**Type**: ${job.employmentType || 'Full-time'}
${job.salary ? `**Salary**: ${job.salary}` : ''}

## Description
${job.description}

## Requirements
${job.requirements.map(r => `- ${r}`).join('\n')}

${job.responsibilities ? `## Responsibilities\n${job.responsibilities.map(r => `- ${r}`).join('\n')}` : ''}

**URL**: ${job.url}
  `.trim();
}

function formatResumeVersionContent(version: ResumeVersion): string {
  return `
# Optimized Resume Version

**Job ID**: ${version.jobId}
**Match Score**: ${version.overallMatchScore}%
**Changes**: ${version.changes.length}

## Changes Made
${version.changes.map((c, i) => `
### Change ${i + 1}: ${c.type.toUpperCase()}
**Section**: ${c.section}
**Reasoning**: ${c.reasoning}

${c.newContent ? `**New Content**:\n${c.newContent}` : ''}
${c.originalContent ? `**Original Content**:\n${c.originalContent}` : ''}
`).join('\n---\n')}
  `.trim();
}

// ============================================
// Utility Functions
// ============================================

function createOperation(
  type: 'add' | 'update' | 'delete',
  memoryType: MemoryType
): SyncOperation {
  return {
    id: crypto.randomUUID(),
    type,
    memoryType,
    status: 'in_progress',
    createdAt: Date.now(),
  };
}

function completeOperation(operation: SyncOperation): void {
  operation.status = 'completed';
  operation.completedAt = Date.now();
}

function failOperation(operation: SyncOperation, error: unknown): void {
  operation.status = 'failed';
  operation.error = error instanceof Error ? error.message : String(error);
  operation.completedAt = Date.now();
}

function extractTechnologies(requirements: string[]): string[] {
  const techKeywords = [
    'javascript', 'typescript', 'python', 'java', 'react', 'node',
    'angular', 'vue', 'sql', 'nosql', 'mongodb', 'postgresql', 'aws',
    'azure', 'docker', 'kubernetes', 'git', 'ci/cd', 'rest', 'graphql',
  ];

  const found = new Set<string>();
  const text = requirements.join(' ').toLowerCase();

  for (const tech of techKeywords) {
    if (text.includes(tech)) {
      found.add(tech);
    }
  }

  return Array.from(found);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Individual Sync Functions
// ============================================

/**
 * Sync a single job posting to SuperMemory
 */
export async function syncJob(userId: string, job: JobPosting): Promise<boolean> {
  if (!memoryService.isEnabled()) {
    return false;
  }

  try {
    const content = formatJobContent(job);
    const metadata: Omit<JobPostingMetadata, 'type' | 'userId' | 'createdAt'> = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      employmentType: job.employmentType,
      url: job.url,
      status: job.status,
      scannedAt: job.createdAt,
      technologies: extractTechnologies(job.requirements),
    };

    await jobPostingService.add(userId, content, metadata);
    return true;
  } catch (error) {
    console.error(`[Sync] Failed to sync job ${job.id}:`, error);
    return false;
  }
}

/**
 * Sync a single resume version to SuperMemory
 */
export async function syncResumeVersion(
  userId: string,
  version: ResumeVersion
): Promise<boolean> {
  if (!memoryService.isEnabled()) {
    return false;
  }

  try {
    const content = formatResumeVersionContent(version);
    const metadata: Omit<ResumeVersionMetadata, 'type' | 'userId' | 'createdAt'> = {
      versionId: version.id,
      jobId: version.jobId,
      overallMatchScore: version.overallMatchScore,
      changesCount: version.changes.length,
      acceptedChangesCount: version.acceptedChanges?.length || 0,
      optimizedAt: version.createdAt,
      wasAccepted: (version.acceptedChanges?.length || 0) > 0,
    };

    await resumeVersionService.add(userId, content, metadata);
    return true;
  } catch (error) {
    console.error(`[Sync] Failed to sync resume version ${version.id}:`, error);
    return false;
  }
}
