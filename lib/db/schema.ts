import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  boolean,
  integer,
  real,
  jsonb,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────────────────────────

export const careerPlatformEnum = pgEnum('career_platform', [
  'greenhouse', 'lever', 'ashby', 'workday', 'stripe', 'cloudflare', 'unknown',
]);

export const queueStatusEnum = pgEnum('queue_status', [
  'pending', 'approved', 'rejected', 'submitted', 'failed',
]);

export const trackerStatusEnum = pgEnum('tracker_status', [
  'submitted', 'failed', 'pending',
]);

export const jobPostingStatusEnum = pgEnum('job_posting_status', [
  'new', 'reviewed', 'applied', 'interviewing', 'rejected', 'accepted',
]);

// ── Companies ──────────────────────────────────────────────────────────────

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  platform: careerPlatformEnum('platform').notNull(),
  boardToken: varchar('board_token', { length: 255 }).notNull(),
  careersUrl: text('careers_url').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('companies_name_idx').on(table.name),
]);

// ── Application Queue ──────────────────────────────────────────────────────

export const applicationQueue = pgTable('application_queue', {
  id: serial('id').primaryKey(),
  shortId: varchar('short_id', { length: 16 }).notNull(),
  jobTitle: text('job_title').notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  url: text('url').notNull(),
  location: text('location').notNull().default(''),
  matchScore: real('match_score').notNull().default(0),
  gaps: jsonb('gaps').notNull().default([]),
  strengths: jsonb('strengths').notNull().default([]),
  tailoredResumePath: text('tailored_resume_path').notNull().default(''),
  tailoredPdfPath: text('tailored_pdf_path').notNull().default(''),
  status: queueStatusEnum('status').notNull().default('pending'),
  queuedAt: timestamp('queued_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  submittedAt: timestamp('submitted_at'),
  error: text('error'),
}, (table) => [
  uniqueIndex('application_queue_url_idx').on(table.url),
]);

// ── Application Tracker ────────────────────────────────────────────────────

export const applicationTracker = pgTable('application_tracker', {
  id: serial('id').primaryKey(),
  trackId: varchar('track_id', { length: 64 }).notNull(),
  jobId: text('job_id').notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  role: text('role'),
  url: text('url'),
  platform: varchar('platform', { length: 64 }).notNull(),
  status: trackerStatusEnum('status').notNull().default('pending'),
  confirmationId: text('confirmation_id'),
  error: text('error'),
  submittedAt: timestamp('submitted_at').notNull(),
});

// ── Job Postings ───────────────────────────────────────────────────────────

export const jobPostings = pgTable('job_postings', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  company: varchar('company', { length: 255 }).notNull(),
  description: text('description'),
  requirements: jsonb('requirements').default([]),
  embedding: jsonb('embedding'),
  overallMatch: real('overall_match'),
  status: jobPostingStatusEnum('status').notNull().default('new'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('job_postings_url_idx').on(table.url),
]);

// ── Resume Versions ────────────────────────────────────────────────────────

export const resumeVersions = pgTable('resume_versions', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').references(() => jobPostings.id),
  originalLatex: text('original_latex'),
  tailoredLatex: text('tailored_latex'),
  changes: jsonb('changes').default([]),
  overallMatchScore: real('overall_match_score'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
