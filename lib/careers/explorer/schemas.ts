import { z } from 'zod';

export const JobListingSchema = z.object({
  jobs: z.array(z.object({
    title: z.string().describe("Job title"),
    location: z.string().nullable().optional().describe("Job location"),
    team: z.string().nullable().optional().describe("Department or team name"),
    url: z.string().describe("Direct URL to the job posting"),
  }))
});

export const CareersPageSchema = z.object({
  careersUrl: z.string().describe("The main careers page URL"),
  hasJobListings: z.boolean(),
  atsType: z.enum(['greenhouse', 'lever', 'ashby', 'workday', 'icims', 'custom', 'unknown']).optional(),
  boardToken: z.string().optional().describe("ATS board token if detected"),
});

export type JobListingData = z.infer<typeof JobListingSchema>;
export type CareersPageData = z.infer<typeof CareersPageSchema>;
