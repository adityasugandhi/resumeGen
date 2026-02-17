import { ApplicantProfile } from './types';

const DEFAULT_PROFILE: ApplicantProfile = {
  firstName: 'Aditya',
  lastName: 'Sugandhi',
  email: 'adityasugandhi.dev.ai@gmail.com',
  phone: '+1 448 500 6857',
  githubUrl: 'https://github.com/adityasugandhi',
  websiteUrl: 'https://adityasugandhi.com',
  location: 'United States',
};

export function getDefaultProfile(): ApplicantProfile {
  return { ...DEFAULT_PROFILE };
}

export function getProfileFromEnv(): ApplicantProfile {
  return {
    firstName: process.env.APPLICANT_FIRST_NAME || DEFAULT_PROFILE.firstName,
    lastName: process.env.APPLICANT_LAST_NAME || DEFAULT_PROFILE.lastName,
    email: process.env.APPLICANT_EMAIL || DEFAULT_PROFILE.email,
    phone: process.env.APPLICANT_PHONE || DEFAULT_PROFILE.phone,
    linkedinUrl: process.env.APPLICANT_LINKEDIN || DEFAULT_PROFILE.linkedinUrl,
    githubUrl: process.env.APPLICANT_GITHUB || DEFAULT_PROFILE.githubUrl,
    websiteUrl: process.env.APPLICANT_WEBSITE || DEFAULT_PROFILE.websiteUrl,
    location: process.env.APPLICANT_LOCATION || DEFAULT_PROFILE.location,
  };
}
