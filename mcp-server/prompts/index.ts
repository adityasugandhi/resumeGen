/**
 * Prompts for MCP Server
 *
 * Pre-configured prompts for common resume editing and review workflows
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getFileSystemClient } from '../integrations';

/**
 * Register all prompts with the MCP server
 */
export function registerPrompts(server: McpServer): void {

  // Prompt: Review Resume
  server.registerPrompt(
    'review-resume',
    {
      title: 'Comprehensive Resume Review',
      description: 'Get AI-powered comprehensive feedback on resume content, structure, and ATS optimization',
      argsSchema: {
        fileId: z.string().optional().describe('ID of the resume file to review'),
        fileName: z.string().optional().describe('Name of the resume file to review'),
        focusOn: z.string().optional().describe('Specific area to focus the review on (overall, technical-skills, work-experience, projects, education, ats-optimization, formatting)')
      }
    },
    async ({ fileId, fileName, focusOn = 'overall' }) => {
      let resumeContent = '';
      let sourceFile = '';

      if (fileId || fileName) {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        const file = fileId
          ? await fileClient.getFile(fileId)
          : await fileClient.getFileByName(fileName!);

        if (file && file.content) {
          resumeContent = file.content;
          sourceFile = file.name;
        }
      }

      const focusDescription = focusOn === 'overall'
        ? 'all aspects of the resume'
        : focusOn.replace(/-/g, ' ');

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please provide a comprehensive review of this LaTeX resume${sourceFile ? ` (${sourceFile})` : ''}, focusing on ${focusDescription}.

Analyze and provide feedback on:
1. Content Quality & Impact: Are achievements quantified? Are action verbs strong?
2. ATS Optimization: Keywords, formatting, structure for Applicant Tracking Systems
3. Technical Accuracy: Proper terminology, current technologies, skill relevance
4. Clarity & Conciseness: Is the content clear and easy to scan?
5. Visual Hierarchy: Section organization, use of formatting, readability
6. Grammar & Style: Professional tone, consistency, proper language

${resumeContent ? `\nResume Content:\n${resumeContent}` : '\nPlease provide the resume content to review.'}

Provide specific, actionable recommendations with examples where appropriate.`
          }
        }]
      };
    }
  );

  // Prompt: Improve Section
  server.registerPrompt(
    'improve-section',
    {
      title: 'Improve Resume Section',
      description: 'Get targeted suggestions for improving a specific section of your resume',
      argsSchema: {
        sectionName: z.string().describe('Name of the section to improve (e.g., "Work Experience", "Projects")'),
        sectionContent: z.string().optional().describe('Content of the section to improve'),
        goal: z.string().optional().describe('What you want to achieve with this section')
      }
    },
    async ({ sectionName, sectionContent = '', goal = 'make it more impactful' }) => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `I need help improving the "${sectionName}" section of my resume. Goal: ${goal}

${sectionContent ? `Current content:\n${sectionContent}\n` : ''}

Please provide:
1. Specific improvements for this section
2. Better ways to phrase achievements or skills
3. Suggestions for quantifying impact where possible
4. Examples of strong bullet points for this type of section
5. Common mistakes to avoid

Make your suggestions actionable and specific to the "${sectionName}" section.`
          }
        }]
      };
    }
  );

  // Prompt: Fix LaTeX Error
  server.registerPrompt(
    'fix-latex-error',
    {
      title: 'Fix LaTeX Compilation Error',
      description: 'Get help debugging and fixing LaTeX compilation errors',
      argsSchema: {
        errorMessage: z.string().describe('The error message from LaTeX compilation'),
        latexCode: z.string().optional().describe('The LaTeX code causing the error'),
        lineNumber: z.string().optional().describe('Line number where the error occurred')
      }
    },
    async ({ errorMessage, latexCode = '', lineNumber }) => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `I'm getting a LaTeX compilation error and need help fixing it.

Error message: ${errorMessage}
${lineNumber ? `Line number: ${lineNumber}` : ''}

${latexCode ? `LaTeX code:\n${latexCode}\n` : ''}

Please help me:
1. Understand what's causing this error
2. Provide a fix for the error
3. Explain how to avoid this error in the future
4. Suggest any best practices related to this issue`
          }
        }]
      };
    }
  );

  // Prompt: Optimize Formatting
  server.registerPrompt(
    'optimize-formatting',
    {
      title: 'Optimize Resume Formatting',
      description: 'Get suggestions for improving visual hierarchy and formatting',
      argsSchema: {
        fileId: z.string().optional().describe('ID of the resume file'),
        fileName: z.string().optional().describe('Name of the resume file'),
        concern: z.string().optional().describe('Specific formatting concern')
      }
    },
    async ({ fileId, fileName, concern = 'general formatting improvements' }) => {
      let resumeContent = '';

      if (fileId || fileName) {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        const file = fileId
          ? await fileClient.getFile(fileId)
          : await fileClient.getFileByName(fileName!);

        if (file && file.content) {
          resumeContent = file.content;
        }
      }

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please review the formatting and visual hierarchy of this resume LaTeX code.

Specific concern: ${concern}

${resumeContent ? `\nLaTeX code:\n${resumeContent}\n` : '\nPlease provide the resume code to review.'}

Provide recommendations for:
1. Visual hierarchy and section organization
2. Spacing and whitespace usage
3. Font choices and emphasis
4. Alignment and consistency
5. Overall professional appearance
6. LaTeX code improvements for better formatting

Focus on making the resume visually appealing and easy to scan while maintaining ATS compatibility.`
          }
        }]
      };
    }
  );

  // Prompt: Check Grammar
  server.registerPrompt(
    'check-grammar',
    {
      title: 'Grammar and Clarity Check',
      description: 'Review resume content for grammar, clarity, and professional tone',
      argsSchema: {
        content: z.string().describe('Resume content to check for grammar and clarity'),
        section: z.string().optional().describe('Specific section being reviewed')
      }
    },
    async ({ content, section = 'resume' }) => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please review this ${section} content for grammar, clarity, and professional tone.

Content:
${content}

Please check for:
1. Grammar and spelling errors
2. Clarity and conciseness
3. Professional tone and word choice
4. Consistency in tense and voice
5. Unnecessary words or redundancy
6. Awkward phrasing

Provide specific corrections and explain why they improve the content.`
          }
        }]
      };
    }
  );

  // Prompt: Tailor Resume for Job
  server.registerPrompt(
    'tailor-resume',
    {
      title: 'Tailor Resume for Specific Job',
      description: 'Get guidance on tailoring your resume for a specific job posting',
      argsSchema: {
        jobTitle: z.string().describe('Target job title'),
        company: z.string().optional().describe('Company name'),
        jobDescription: z.string().optional().describe('Job description or key requirements'),
        fileId: z.string().optional().describe('ID of your current resume')
      }
    },
    async ({ jobTitle, company, jobDescription = '', fileId }) => {
      let currentResume = '';

      if (fileId) {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();
        const file = await fileClient.getFile(fileId);
        if (file && file.content) {
          currentResume = file.content;
        }
      }

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Help me tailor my resume for this job opportunity:

Job Title: ${jobTitle}
${company ? `Company: ${company}` : ''}

${jobDescription ? `Job Description/Requirements:\n${jobDescription}\n` : ''}

${currentResume ? `\nMy current resume:\n${currentResume}\n` : ''}

Please provide specific recommendations for:
1. Keywords and skills to emphasize from the job description
2. Experiences or projects to highlight
3. Achievements to expand or quantify
4. Technical skills to feature prominently
5. Sections that may need reordering for this role
6. Language and terminology alignment with the job posting

Make your suggestions concrete and actionable.`
          }
        }]
      };
    }
  );

  // Prompt: Add Work Experience
  server.registerPrompt(
    'add-experience',
    {
      title: 'Add Work Experience',
      description: 'Get guidance on adding a new work experience entry to your resume',
      argsSchema: {
        jobTitle: z.string().describe('Job title/position'),
        company: z.string().describe('Company name'),
        duration: z.string().describe('Employment duration (e.g., "Jan 2020 - Present")'),
        responsibilities: z.string().optional().describe('Brief description of key responsibilities')
      }
    },
    async ({ jobTitle, company, duration, responsibilities = '' }) => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Help me write a strong work experience entry for my resume.

Position: ${jobTitle}
Company: ${company}
Duration: ${duration}
${responsibilities ? `\nResponsibilities: ${responsibilities}` : ''}

Please help me:
1. Structure the entry in LaTeX format
2. Write impactful bullet points using strong action verbs
3. Quantify achievements where possible
4. Highlight relevant technical skills and technologies
5. Focus on accomplishments rather than just duties
6. Make it ATS-friendly with appropriate keywords

Provide 3-5 strong bullet points that I can use or adapt for this role.`
          }
        }]
      };
    }
  );

  // Prompt: Convert to LaTeX
  server.registerPrompt(
    'convert-to-latex',
    {
      title: 'Convert Resume to LaTeX',
      description: 'Convert plain text or formatted resume content to LaTeX format',
      argsSchema: {
        content: z.string().describe('Resume content in plain text or other format'),
        template: z.string().optional().describe('LaTeX template to use for conversion (default, simple)')
      }
    },
    async ({ content, template = 'default' }) => {
      const templateInfo = template === 'default'
        ? 'professional resume template with custom formatting'
        : 'simple, clean document template';

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Please convert this resume content to LaTeX format using a ${templateInfo}.

Resume content:
${content}

Please:
1. Structure the content with appropriate LaTeX commands
2. Use professional formatting and spacing
3. Include all necessary packages
4. Organize sections clearly (Summary, Skills, Experience, Education, etc.)
5. Make it ATS-compatible
6. Add comments explaining the LaTeX structure

Provide complete, compilable LaTeX code that I can use directly.`
          }
        }]
      };
    }
  );
}
