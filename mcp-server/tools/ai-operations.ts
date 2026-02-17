/**
 * AI Operation Tools for MCP Server
 *
 * Tools for AI-powered resume analysis and optimization
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getFileSystemClient } from '../integrations';

/**
 * Register all AI operation tools with the MCP server
 */
export function registerAIOperationTools(server: McpServer): void {

  // Tool: analyze-resume
  server.registerTool(
    'analyze-resume',
    {
      title: 'AI Resume Analysis',
      description: 'Analyze resume content using AI to provide improvement suggestions, ATS optimization, and impact assessment',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to analyze'),
        fileName: z.string().optional().describe('Name of the file to analyze'),
        content: z.string().optional().describe('Resume content to analyze (alternative to file reference)'),
        focusAreas: z.array(z.enum([
          'ats-optimization',
          'clarity',
          'impact',
          'grammar',
          'formatting',
          'technical-accuracy'
        ])).optional().default(['ats-optimization', 'clarity', 'impact'])
          .describe('Specific areas to focus on during analysis')
      },
      outputSchema: {
        success: z.boolean(),
        analysis: z.string().optional().describe('Detailed AI analysis of the resume'),
        suggestions: z.array(z.object({
          section: z.string(),
          severity: z.enum(['critical', 'important', 'suggestion']),
          issue: z.string(),
          recommendation: z.string()
        })).optional(),
        overallScore: z.number().min(0).max(100).optional(),
        error: z.string().optional()
      }
    },
    async ({ fileId, fileName, content, focusAreas = ['ats-optimization', 'clarity', 'impact'] }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        // Get resume content
        let resumeContent = content;
        let sourceFileName = 'provided content';

        if (!resumeContent) {
          if (fileId) {
            const file = await fileClient.getFile(fileId);
            if (!file) {
              throw new Error(`File with ID "${fileId}" not found`);
            }
            resumeContent = file.content || '';
            sourceFileName = file.name;
          } else if (fileName) {
            const file = await fileClient.getFileByName(fileName);
            if (!file) {
              throw new Error(`File "${fileName}" not found`);
            }
            resumeContent = file.content || '';
            sourceFileName = file.name;
          } else {
            throw new Error('Must provide either fileId, fileName, or content');
          }
        }

        if (!resumeContent) {
          throw new Error('No resume content to analyze');
        }

        // Use MCP's sampling feature to analyze with AI
        const analysisPrompt = `You are an expert resume reviewer and career coach. Analyze this LaTeX resume and provide detailed, actionable feedback.

Focus Areas: ${focusAreas.join(', ')}

Resume Content:
${resumeContent}

Provide your analysis in the following format:

1. OVERALL SCORE (0-100): [score]

2. KEY STRENGTHS:
- [List 3-5 strengths]

3. AREAS FOR IMPROVEMENT:
For each issue, format as:
[Section Name] | [Severity: critical/important/suggestion] | [Issue] | [Recommendation]

4. SPECIFIC RECOMMENDATIONS:
- [Detailed recommendations for each focus area]

5. ATS OPTIMIZATION:
- [Specific advice for Applicant Tracking Systems]`;

        const response = await server.server.createMessage({
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: analysisPrompt
            }
          }],
          maxTokens: 2500
        });

        const analysisText = response.content.type === 'text' ? response.content.text : 'Unable to generate analysis';

        // Parse the response to extract structured data
        const scoreMatch = analysisText.match(/OVERALL SCORE.*?(\d+)/i);
        const overallScore = scoreMatch ? parseInt(scoreMatch[1]) : undefined;

        // Extract suggestions (simplified parsing)
        const suggestions: Array<{
          section: string;
          severity: 'critical' | 'important' | 'suggestion';
          issue: string;
          recommendation: string;
        }> = [];

        const suggestionPattern = /\[(.*?)\]\s*\|\s*\[Severity:\s*(critical|important|suggestion)\]\s*\|\s*\[(.*?)\]\s*\|\s*\[(.*?)\]/gi;
        let match;
        while ((match = suggestionPattern.exec(analysisText)) !== null) {
          suggestions.push({
            section: match[1],
            severity: match[2] as 'critical' | 'important' | 'suggestion',
            issue: match[3],
            recommendation: match[4]
          });
        }

        const output = {
          success: true,
          analysis: analysisText,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          overallScore
        };

        return {
          content: [{
            type: 'text',
            text: `Resume Analysis for: ${sourceFileName}\n\n${analysisText}`
          }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{
            type: 'text',
            text: `Analysis failed: ${output.error}`
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: optimize-latex-formatting
  server.registerTool(
    'optimize-latex-formatting',
    {
      title: 'Optimize LaTeX Formatting',
      description: 'Get AI-powered suggestions for improving LaTeX code formatting and structure',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to optimize'),
        fileName: z.string().optional().describe('Name of the file to optimize'),
        content: z.string().optional().describe('LaTeX content to optimize')
      },
      outputSchema: {
        success: z.boolean(),
        suggestions: z.string().optional(),
        optimizedCode: z.string().optional().describe('Suggested optimized LaTeX code'),
        error: z.string().optional()
      }
    },
    async ({ fileId, fileName, content }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        // Get LaTeX content
        let latexContent = content;

        if (!latexContent) {
          if (fileId) {
            const file = await fileClient.getFile(fileId);
            if (!file) {
              throw new Error(`File with ID "${fileId}" not found`);
            }
            latexContent = file.content || '';
          } else if (fileName) {
            const file = await fileClient.getFileByName(fileName);
            if (!file) {
              throw new Error(`File "${fileName}" not found`);
            }
            latexContent = file.content || '';
          } else {
            throw new Error('Must provide either fileId, fileName, or content');
          }
        }

        if (!latexContent) {
          throw new Error('No LaTeX content to optimize');
        }

        // Use AI to suggest optimizations
        const optimizationPrompt = `You are a LaTeX expert. Analyze this LaTeX resume code and suggest formatting improvements.

Focus on:
1. Code organization and readability
2. Efficient use of LaTeX commands
3. Better spacing and layout
4. Simplification opportunities
5. Best practices

LaTeX Code:
${latexContent}

Provide:
1. Specific suggestions for improvement
2. If significant improvements are possible, provide optimized code sections

Keep the content the same, only optimize the LaTeX code structure and formatting.`;

        const response = await server.server.createMessage({
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: optimizationPrompt
            }
          }],
          maxTokens: 3000
        });

        const suggestionText = response.content.type === 'text' ? response.content.text : 'Unable to generate suggestions';

        const output = {
          success: true,
          suggestions: suggestionText
        };

        return {
          content: [{
            type: 'text',
            text: suggestionText
          }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{
            type: 'text',
            text: `Optimization failed: ${output.error}`
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: tailor-resume
  server.registerTool(
    'tailor-resume',
    {
      title: 'Tailor Resume for Job',
      description: 'Get AI-powered suggestions for tailoring resume content for a specific job role',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the resume file'),
        fileName: z.string().optional().describe('Name of the resume file'),
        jobTitle: z.string().describe('Target job title'),
        jobDescription: z.string().optional().describe('Job description or key requirements'),
        company: z.string().optional().describe('Target company name')
      },
      outputSchema: {
        success: z.boolean(),
        tailoredSuggestions: z.string().optional(),
        focusAreas: z.array(z.string()).optional(),
        error: z.string().optional()
      }
    },
    async ({ fileId, fileName, jobTitle, jobDescription, company }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        // Get resume content
        let resumeContent = '';

        if (fileId) {
          const file = await fileClient.getFile(fileId);
          if (!file) {
            throw new Error(`File with ID "${fileId}" not found`);
          }
          resumeContent = file.content || '';
        } else if (fileName) {
          const file = await fileClient.getFileByName(fileName);
          if (!file) {
            throw new Error(`File "${fileName}" not found`);
          }
          resumeContent = file.content || '';
        } else {
          throw new Error('Must provide either fileId or fileName');
        }

        if (!resumeContent) {
          throw new Error('Resume file has no content');
        }

        // Create tailoring prompt
        const tailoringPrompt = `You are a career coach specializing in resume optimization. Help tailor this resume for a specific job opportunity.

Target Job: ${jobTitle}${company ? ` at ${company}` : ''}
${jobDescription ? `\nJob Description/Requirements:\n${jobDescription}` : ''}

Current Resume:
${resumeContent}

Provide specific, actionable suggestions for:
1. Which experiences to highlight
2. Skills and keywords to emphasize
3. Bullet points to modify for better alignment
4. New achievements or metrics to add
5. Sections that may need reordering
6. Technical skills or tools to feature prominently

Format your response as practical recommendations the user can implement.`;

        const response = await server.server.createMessage({
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: tailoringPrompt
            }
          }],
          maxTokens: 2000
        });

        const suggestions = response.content.type === 'text' ? response.content.text : 'Unable to generate suggestions';

        const output = {
          success: true,
          tailoredSuggestions: suggestions,
          focusAreas: [
            'Experience highlighting',
            'Keyword optimization',
            'Skills emphasis',
            'Content alignment'
          ]
        };

        return {
          content: [{
            type: 'text',
            text: `Tailoring suggestions for ${jobTitle}:\n\n${suggestions}`
          }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{
            type: 'text',
            text: `Tailoring failed: ${output.error}`
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );
}
