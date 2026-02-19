// lib/careers/auto-apply barrel — re-exports public API

// Types
export type {
  ApplicantProfile,
  ApplicationPayload,
  ApplicationResult,
  ApplicationFormField,
  ApplicationFormSchema,
  BrowserSubmissionOptions,
  ApplyOptions,
} from './types';

// Engine
export { JobApplicationEngine } from './engine';

// Tracker
export {
  trackApplication,
  getApplicationHistory,
  getApplicationsByCompany,
  getApplicationStats,
  PersistentTracker,
} from './tracker';
export type { TrackedApplication } from './tracker';

// Resume Selector
export { selectResume } from './resume-selector';

// Applicant Profile
export { getDefaultProfile, getProfileFromEnv } from './applicant-profile';
