import { CareerPlatform } from '@/lib/careers/types';
import {
  ApplicationPayload,
  ApplicationResult,
  ApplicationFormSchema,
  ApplicationFormField,
} from '../types';

export abstract class BaseApplicationProvider {
  abstract readonly platform: CareerPlatform;

  abstract buildApplicationUrl(jobId: string, boardToken: string): string;
  abstract getFormSchema(jobId: string, boardToken: string): Promise<ApplicationFormSchema>;
  abstract submitApplication(
    jobId: string,
    boardToken: string,
    payload: ApplicationPayload
  ): Promise<ApplicationResult>;

  async apply(
    jobId: string,
    boardToken: string,
    payload: ApplicationPayload
  ): Promise<ApplicationResult> {
    const schema = await this.getFormSchema(jobId, boardToken);
    this.validatePayload(payload, schema);
    return await this.submitApplication(jobId, boardToken, payload);
  }

  protected validatePayload(payload: ApplicationPayload, schema: ApplicationFormSchema): void {
    const missingFields: string[] = [];
    for (const field of schema.fields) {
      if (!field.required) continue;
      switch (field.type) {
        case 'email':
          if (!payload.profile.email) missingFields.push(field.label);
          break;
        case 'phone':
          if (!payload.profile.phone) missingFields.push(field.label);
          break;
        case 'file':
          if (!payload.resumeFile && !payload.resumeFilePath) missingFields.push(field.label);
          break;
        default:
          if (!payload.answers?.[field.id] && !this.getProfileFieldValue(payload, field)) {
            missingFields.push(field.label);
          }
      }
    }
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  private getProfileFieldValue(payload: ApplicationPayload, field: ApplicationFormField): string | undefined {
    const label = field.label.toLowerCase();
    if (label.includes('first name')) return payload.profile.firstName;
    if (label.includes('last name')) return payload.profile.lastName;
    if (label.includes('email')) return payload.profile.email;
    if (label.includes('phone')) return payload.profile.phone;
    if (label.includes('linkedin')) return payload.profile.linkedinUrl;
    if (label.includes('github')) return payload.profile.githubUrl;
    if (label.includes('website') || label.includes('portfolio')) return payload.profile.websiteUrl;
    if (label.includes('location')) return payload.profile.location;
    return undefined;
  }
}
