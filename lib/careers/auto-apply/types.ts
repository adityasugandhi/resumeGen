import { CareerPlatform } from '@/lib/careers/types';

export interface ApplicantProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  location?: string;
}

export interface ApplicationPayload {
  profile: ApplicantProfile;
  resumeFile: File | Buffer;
  resumeFilename: string;
  resumeFilePath?: string;
  coverLetter?: string;
  answers?: Record<string, string>;
}

export interface ApplicationResult {
  success: boolean;
  jobId: string;
  company: string;
  platform: CareerPlatform;
  confirmationId?: string;
  error?: string;
  submittedAt: number;
}

export interface ApplicationFormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'file' | 'url' | 'email' | 'phone';
  required: boolean;
  options?: string[];
}

export interface ApplicationFormSchema {
  jobId: string;
  fields: ApplicationFormField[];
}

export interface BrowserSubmissionOptions {
  headed?: boolean;
  timeout?: number;
  screenshotOnError?: boolean;
}

export interface ApplyOptions {
  coverLetter?: string;
  answers?: Record<string, string>;
  dryRun?: boolean;
}
