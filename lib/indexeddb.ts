import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { FileSystemNode, Company } from '@/types';
import { TrackedApplication } from '@/lib/careers/auto-apply/tracker';

// Job posting data structure
export interface JobPosting {
  id: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  employmentType?: string;
  description: string;
  requirements: string[];
  responsibilities?: string[];
  qualifications?: string[];
  embedding: number[]; // Vector embedding for semantic search
  overallMatch?: number; // 0-100 match score
  status: 'scanned' | 'applied' | 'interviewing' | 'rejected' | 'offer';
  createdAt: number;
  updatedAt?: number;
}

// Resume version with tracked changes
export interface ResumeVersion {
  id: string;
  jobId: string; // Associated job posting
  originalLatex: string;
  tailoredLatex: string;
  changes: ResumeChange[];
  overallMatchScore: number;
  createdAt: number;
  acceptedChanges?: string[]; // IDs of accepted changes
}

export interface ResumeChange {
  id: string;
  type: 'added' | 'modified' | 'deleted';
  section: string; // e.g., "Experience", "Skills", "Summary"
  originalContent?: string;
  newContent?: string;
  reasoning: string;
  lineNumber?: number;
}

// Master resume with component embeddings
export interface MasterResume {
  userId: string;
  experiences: ResumeExperience[];
  skills: {
    technical: string[];
    soft: string[];
    tools: string[];
    languages: string[];
  };
  projects?: ResumeProject[];
  education?: ResumeEducation[];
  summary?: string;
  latexTemplate: string;
  embeddings: {
    experiences: Record<string, number[]>; // id -> embedding
    skills: number[];
    projects?: Record<string, number[]>;
    summary?: number[];
  };
  updatedAt: number;
}

export interface ResumeExperience {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  bullets: string[];
  embedding?: number[];
}

export interface ResumeProject {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  bullets: string[];
  embedding?: number[];
}

export interface ResumeEducation {
  id: string;
  institution: string;
  degree: string;
  field: string;
  graduationDate: string;
}

interface LaTeXEditorDB extends DBSchema {
  files: {
    key: string;
    value: FileSystemNode;
    indexes: { 'by-parent': string; 'by-company': string };
  };
  settings: {
    key: string;
    value: unknown;
  };
  jobs: {
    key: string;
    value: JobPosting;
    indexes: { 'by-status': string; 'by-created': number };
  };
  resumeVersions: {
    key: string;
    value: ResumeVersion;
    indexes: { 'by-job': string; 'by-created': number };
  };
  masterResume: {
    key: string;
    value: MasterResume;
  };
  companies: {
    key: string;
    value: Company;
    indexes: { 'by-name': string };
  };
  applications: {
    key: string;
    value: TrackedApplication;
    indexes: { 'by-company': string; 'by-platform': string; 'by-submitted': number };
  };
}

const DB_NAME = 'latex-editor-db';
const DB_VERSION = 4;

let dbInstance: IDBPDatabase<LaTeXEditorDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<LaTeXEditorDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<LaTeXEditorDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Create files store (v1)
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('by-parent', 'parentId');
        fileStore.createIndex('by-company', 'companyId');
      } else if (oldVersion < 3) {
        // Add by-company index for existing files store
        const fileStore = transaction.objectStore('files');
        if (!fileStore.indexNames.contains('by-company')) {
          fileStore.createIndex('by-company', 'companyId');
        }
      }

      // Create settings store (v1)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }

      // Create jobs store (v2)
      if (!db.objectStoreNames.contains('jobs')) {
        const jobStore = db.createObjectStore('jobs', { keyPath: 'id' });
        jobStore.createIndex('by-status', 'status');
        jobStore.createIndex('by-created', 'createdAt');
      }

      // Create resumeVersions store (v2)
      if (!db.objectStoreNames.contains('resumeVersions')) {
        const versionStore = db.createObjectStore('resumeVersions', { keyPath: 'id' });
        versionStore.createIndex('by-job', 'jobId');
        versionStore.createIndex('by-created', 'createdAt');
      }

      // Create masterResume store (v2)
      if (!db.objectStoreNames.contains('masterResume')) {
        db.createObjectStore('masterResume', { keyPath: 'userId' });
      }

      // Create companies store (v3)
      if (!db.objectStoreNames.contains('companies')) {
        const companyStore = db.createObjectStore('companies', { keyPath: 'id' });
        companyStore.createIndex('by-name', 'name');
      }

      // Create applications store (v4)
      if (!db.objectStoreNames.contains('applications')) {
        const appStore = db.createObjectStore('applications', { keyPath: 'id' });
        appStore.createIndex('by-company', 'company');
        appStore.createIndex('by-platform', 'platform');
        appStore.createIndex('by-submitted', 'submittedAt');
      }
    },
  });

  return dbInstance;
}

export async function saveFileSystem(nodes: Record<string, FileSystemNode>, rootIds: string[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('files', 'readwrite');

  // Clear existing files
  await tx.store.clear();

  // Save all nodes
  const promises = Object.values(nodes).map(node => tx.store.put(node));
  await Promise.all(promises);

  // Save root IDs in settings
  await db.put('settings', rootIds, 'rootIds');

  await tx.done;
}

export async function loadFileSystem(): Promise<{ nodes: Record<string, FileSystemNode>; rootIds: string[] }> {
  const db = await initDB();

  // Load all nodes
  const allNodes = await db.getAll('files');
  const nodes: Record<string, FileSystemNode> = {};

  allNodes.forEach(node => {
    nodes[node.id] = node;
  });

  // Load root IDs
  const storedRootIds = await db.get('settings', 'rootIds');
  const rootIds: string[] = Array.isArray(storedRootIds) ? storedRootIds : [];

  return { nodes, rootIds };
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  const db = await initDB();
  await db.put('settings', value, key);
}

export async function loadSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await initDB();
  const value = await db.get('settings', key);
  return value !== undefined ? (value as T) : defaultValue;
}

export async function clearAllData(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(['files', 'settings', 'jobs', 'resumeVersions', 'masterResume', 'applications'], 'readwrite');
  await Promise.all([
    tx.objectStore('files').clear(),
    tx.objectStore('settings').clear(),
    tx.objectStore('jobs').clear(),
    tx.objectStore('resumeVersions').clear(),
    tx.objectStore('masterResume').clear(),
    tx.objectStore('applications').clear(),
  ]);
  await tx.done;
}

// ============================================================================
// Job Posting Operations
// ============================================================================

export async function saveJob(job: JobPosting): Promise<void> {
  const db = await initDB();
  await db.put('jobs', job);
}

export async function getJob(id: string): Promise<JobPosting | undefined> {
  const db = await initDB();
  return await db.get('jobs', id);
}

export async function getAllJobs(): Promise<JobPosting[]> {
  const db = await initDB();
  return await db.getAll('jobs');
}

export async function getJobsByStatus(status: JobPosting['status']): Promise<JobPosting[]> {
  const db = await initDB();
  const index = db.transaction('jobs').store.index('by-status');
  return await index.getAll(status);
}

export async function deleteJob(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('jobs', id);
}

export async function updateJobStatus(id: string, status: JobPosting['status']): Promise<void> {
  const db = await initDB();
  const job = await db.get('jobs', id);
  if (job) {
    job.status = status;
    job.updatedAt = Date.now();
    await db.put('jobs', job);
  }
}

// ============================================================================
// Resume Version Operations
// ============================================================================

export async function saveResumeVersion(version: ResumeVersion): Promise<void> {
  const db = await initDB();
  await db.put('resumeVersions', version);
}

export async function getResumeVersion(id: string): Promise<ResumeVersion | undefined> {
  const db = await initDB();
  return await db.get('resumeVersions', id);
}

export async function getResumeVersionsByJob(jobId: string): Promise<ResumeVersion[]> {
  const db = await initDB();
  const index = db.transaction('resumeVersions').store.index('by-job');
  return await index.getAll(jobId);
}

export async function getAllResumeVersions(): Promise<ResumeVersion[]> {
  const db = await initDB();
  return await db.getAll('resumeVersions');
}

export async function deleteResumeVersion(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('resumeVersions', id);
}

// ============================================================================
// Master Resume Operations
// ============================================================================

export async function saveMasterResume(resume: MasterResume): Promise<void> {
  const db = await initDB();
  resume.updatedAt = Date.now();
  await db.put('masterResume', resume);
}

export async function getMasterResume(userId: string = 'default'): Promise<MasterResume | undefined> {
  const db = await initDB();
  return await db.get('masterResume', userId);
}

export async function deleteMasterResume(userId: string = 'default'): Promise<void> {
  const db = await initDB();
  await db.delete('masterResume', userId);
}

// ============================================================================
// Company Operations
// ============================================================================

export async function saveCompany(company: Company): Promise<void> {
  const db = await initDB();
  await db.put('companies', company);
}

export async function getCompany(id: string): Promise<Company | undefined> {
  const db = await initDB();
  return await db.get('companies', id);
}

export async function getAllCompanies(): Promise<Company[]> {
  const db = await initDB();
  return await db.getAll('companies');
}

export async function getCompanyByName(name: string): Promise<Company | undefined> {
  const db = await initDB();
  const index = db.transaction('companies').store.index('by-name');
  return await index.get(name);
}

export async function deleteCompany(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('companies', id);
}

export async function getFilesByCompany(companyId: string): Promise<FileSystemNode[]> {
  const db = await initDB();
  const index = db.transaction('files').store.index('by-company');
  return await index.getAll(companyId);
}

// ============================================================================
// Application Tracking Operations
// ============================================================================

export async function saveApplication(application: TrackedApplication): Promise<void> {
  const db = await initDB();
  await db.put('applications', application);
}

export async function getApplication(id: string): Promise<TrackedApplication | undefined> {
  const db = await initDB();
  return await db.get('applications', id);
}

export async function getAllApplications(): Promise<TrackedApplication[]> {
  const db = await initDB();
  return await db.getAll('applications');
}

export async function getApplicationsByCompanyName(company: string): Promise<TrackedApplication[]> {
  const db = await initDB();
  const index = db.transaction('applications').store.index('by-company');
  return await index.getAll(company);
}

export async function getApplicationsByPlatform(platform: string): Promise<TrackedApplication[]> {
  const db = await initDB();
  const index = db.transaction('applications').store.index('by-platform');
  return await index.getAll(platform);
}

export async function deleteApplication(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('applications', id);
}
