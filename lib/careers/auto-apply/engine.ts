import { CareerPlatform } from '@/lib/careers/types';
import { getCompanyConfig } from '@/lib/careers/company-registry';
import {
  ApplicantProfile,
  ApplicationPayload,
  ApplicationResult,
  ApplyOptions,
} from './types';
import { BaseApplicationProvider } from './providers/base-provider';
import { GreenhouseApplicationProvider } from './providers/greenhouse-provider';
import { LeverApplicationProvider } from './providers/lever-provider';
import { AshbyApplicationProvider } from './providers/ashby-provider';
import { selectResume } from './resume-selector';
import { trackApplication } from './tracker';
import { readFileSync } from 'fs';

export class JobApplicationEngine {
  private profile: ApplicantProfile;
  private providers: Map<CareerPlatform, BaseApplicationProvider>;

  constructor(profile: ApplicantProfile) {
    this.profile = profile;
    this.providers = new Map();

    this.providers.set('greenhouse', new GreenhouseApplicationProvider());
    this.providers.set('lever', new LeverApplicationProvider());
    this.providers.set('ashby', new AshbyApplicationProvider());
  }

  async apply(
    jobId: string,
    company: string,
    options?: ApplyOptions
  ): Promise<ApplicationResult> {
    const config = await getCompanyConfig(company);
    if (!config) {
      return {
        success: false,
        jobId,
        company,
        platform: 'unknown',
        error: `Company "${company}" not found in registry`,
        submittedAt: Date.now(),
      };
    }

    const provider = this.providers.get(config.platform);
    if (!provider) {
      return {
        success: false,
        jobId,
        company,
        platform: config.platform,
        error: `No provider available for ${config.platform}`,
        submittedAt: Date.now(),
      };
    }

    // Select best resume
    const resumePath = selectResume(company);

    if (options?.dryRun) {
      return {
        success: true,
        jobId,
        company,
        platform: config.platform,
        confirmationId: 'DRY_RUN',
        submittedAt: Date.now(),
      };
    }

    const resumeBuffer = readFileSync(resumePath);
    const resumeFilename = resumePath.split('/').pop() || 'resume.pdf';

    const payload: ApplicationPayload = {
      profile: this.profile,
      resumeFile: resumeBuffer,
      resumeFilename,
      resumeFilePath: resumePath,
      coverLetter: options?.coverLetter,
      answers: options?.answers,
    };

    const result = await provider.apply(jobId, config.boardToken, payload);
    await trackApplication(result, undefined, undefined);
    return result;
  }

  async bulkApply(
    jobs: { jobId: string; company: string; options?: ApplyOptions }[]
  ): Promise<ApplicationResult[]> {
    const results: ApplicationResult[] = [];

    for (const job of jobs) {
      const result = await this.apply(job.jobId, job.company, job.options);
      results.push(result);

      // Longer delay between applications for human-like pacing
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return results;
  }

  async getFormSchema(jobId: string, company: string) {
    const config = await getCompanyConfig(company);
    if (!config) throw new Error(`Company "${company}" not found in registry`);

    const provider = this.providers.get(config.platform);
    if (!provider) throw new Error(`No provider available for ${config.platform}`);

    return provider.getFormSchema(jobId, config.boardToken);
  }
}
