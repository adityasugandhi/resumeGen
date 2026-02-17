





import Groq from 'groq-sdk';
import { z } from 'zod';

// Zod schema for structured job extraction
export const JobDataSchema = z.object({
  title: z.string().describe('Job title'),
  company: z.string().describe('Company name'),
  location: z.string().optional().describe('Job location (e.g., "San Francisco, CA" or "Remote")'),
  salary: z.string().optional().describe('Salary range or compensation'),
  employmentType: z.string().optional().describe('Employment type (e.g., "Full-time", "Contract")'),
  description: z.string().describe('Full job description'),
  requirements: z.array(z.string()).describe('List of job requirements and qualifications'),
  responsibilities: z.array(z.string()).optional().describe('List of job responsibilities'),
  qualifications: z.array(z.string()).optional().describe('List of required qualifications'),
});

export type JobData = z.infer<typeof JobDataSchema>;

export class JobParser {
  private client: Groq;

  constructor(apiKey?: string) {
    this.client = new Groq({
      apiKey: apiKey || process.env.GROQ_API_KEY,
    });
  }

  /**
   * Extract JSON from AI response using multiple strategies
   */
  private extractJson(response: string): Record<string, unknown> | null {
    const text = response.trim();

    // Strategy 1: Try to parse the entire response as JSON
    try {
      return JSON.parse(text);
    } catch {
      // Continue to other strategies
    }

    // Strategy 2: Extract JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // Continue to other strategies
      }
    }

    // Strategy 3: Find the first complete JSON object using brace matching
    const startIndex = text.indexOf('{');
    if (startIndex !== -1) {
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;

          if (braceCount === 0) {
            const jsonStr = text.substring(startIndex, i + 1);
            try {
              return JSON.parse(jsonStr);
            } catch {
              break; // Invalid JSON, stop trying
            }
          }
        }
      }
    }

    // Strategy 4: Simple regex extraction (fallback)
    const simpleMatch = text.match(/\{[\s\S]*\}/);
    if (simpleMatch) {
      try {
        return JSON.parse(simpleMatch[0]);
      } catch {
        // All strategies failed
      }
    }

    return null;
  }

  /**
   * Parse job posting HTML/text and extract structured data using Groq
   */
  async parseJobPosting(content: string, url: string): Promise<JobData> {
    const prompt = `You are a job posting parser. Extract structured information from the following job posting.

Job URL: ${url}

Job Posting Content:
${content.substring(0, 15000)}

CRITICAL INSTRUCTIONS:
1. Extract ONLY job-related information (title, requirements, responsibilities)
2. IGNORE privacy policies, cookie notices, terms of service, or legal disclaimers
3. IGNORE "Do Not Sell My Personal Information" or GDPR/CCPA text
4. If content is primarily a privacy policy, return all fields as "Not specified"

Extract:
1. Job title (the actual position being hired for)
2. Company name
3. Location (if mentioned, otherwise "Not specified")
4. Salary range (if mentioned)
5. Employment type (Full-time, Part-time, Contract, etc.)
6. Full job description (EXCLUDE privacy policy text)
7. List of requirements/qualifications
8. List of responsibilities
9. List of required qualifications

IMPORTANT: Respond with ONLY a valid JSON object. No explanatory text before or after. No markdown code blocks.

{
  "title": "Job Title",
  "company": "Company Name",
  "location": "Location or Remote",
  "salary": "Salary range if available",
  "employmentType": "Full-time/Part-time/Contract",
  "description": "Full job description text",
  "requirements": ["requirement 1", "requirement 2"],
  "responsibilities": ["responsibility 1", "responsibility 2"],
  "qualifications": ["qualification 1", "qualification 2"]
}`;

    const response = await this.client.chat.completions.create({
      model: process.env.GROQ_JOB_PARSER_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: 'You are an expert at extracting job posting information while filtering out privacy policies, legal text, and non-job content. Focus only on information directly related to the job position.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for structured extraction
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No text response from Groq');
    }

    // Extract JSON from response using multiple strategies
    const jsonData = this.extractJson(responseContent);
    if (!jsonData) {
      console.error('[job-parser] Failed to extract JSON from response:', responseContent.substring(0, 200));
      throw new Error('Could not extract valid JSON from AI response');
    }

    // Validate and parse with Zod
    return JobDataSchema.parse(jsonData);
  }

  /**
   * Generate a concise summary of a job posting
   */
  async generateJobSummary(jobData: JobData): Promise<string> {
    const prompt = `Generate a concise 2-3 sentence summary of this job posting:

Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location || 'Not specified'}
Employment Type: ${jobData.employmentType || 'Not specified'}

Requirements:
${jobData.requirements.slice(0, 5).join('\n')}

Focus on what makes this role unique and what the ideal candidate should have.`;

    const response = await this.client.chat.completions.create({
      model: process.env.GROQ_JOB_PARSER_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Slightly higher for creative summary
    });

    const summaryContent = response.choices[0]?.message?.content;
    if (!summaryContent) {
      throw new Error('No text response from Groq');
    }

    return summaryContent.trim();
  }
}
