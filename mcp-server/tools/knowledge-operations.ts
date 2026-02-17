/**
 * Knowledge Operation Tools for MCP Server
 *
 * Tools for project knowledge base search and RAG-based resume tailoring
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAPIClient } from '../integrations';

/**
 * Register all knowledge operation tools with the MCP server
 */
export function registerKnowledgeOperationTools(server: McpServer): void {

  // Tool: search-projects
  server.registerTool(
    'search-projects',
    {
      title: 'Search Project Knowledge Base',
      description: 'Search the project knowledge base for relevant information using semantic similarity. Use this to find projects matching specific technologies, skills, or descriptions.',
      inputSchema: {
        query: z.string().describe('Search query (e.g., "React TypeScript projects", "AI automation", "Python FastAPI")'),
        topK: z.number().optional().default(5).describe('Number of results to return (default: 5)'),
        projectNames: z.array(z.string()).optional().describe('Filter to specific projects'),
        fileTypes: z.array(z.enum(['claude_md', 'readme', 'package_json', 'pyproject', 'makefile', 'other'])).optional()
          .describe('Filter by file types'),
        language: z.string().optional().describe('Filter by language (typescript, python, swift, mixed)')
      },
      outputSchema: {
        success: z.boolean(),
        totalResults: z.number().optional(),
        results: z.array(z.object({
          projectName: z.string(),
          chunk: z.string(),
          score: z.number(),
          techStack: z.array(z.string()),
          description: z.string().optional()
        })).optional(),
        error: z.string().optional()
      }
    },
    async ({ query, topK = 5, projectNames, fileTypes, language }) => {
      try {
        const apiClient = getAPIClient();

        // Call the search API
        const response = await fetch(`${apiClient.getBaseUrl()}/api/knowledge/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            topK,
            filters: {
              projectNames,
              fileTypes,
              language
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Search API returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Search failed');
        }

        // Format results for display
        const formattedResults = data.results.map((r: any) => ({
          projectName: r.projectName,
          chunk: r.chunk.slice(0, 300) + (r.chunk.length > 300 ? '...' : ''),
          score: Math.round(r.score * 100) / 100,
          techStack: r.metadata?.techStack || [],
          description: r.metadata?.description?.slice(0, 150) || ''
        }));

        const output = {
          success: true,
          totalResults: data.totalResults,
          results: formattedResults
        };

        // Build text response
        let textResponse = `Found ${data.totalResults} results for "${query}":\n\n`;
        for (const result of formattedResults) {
          textResponse += `## ${result.projectName} (Score: ${result.score})\n`;
          if (result.techStack.length > 0) {
            textResponse += `Tech: ${result.techStack.join(', ')}\n`;
          }
          if (result.description) {
            textResponse += `${result.description}\n`;
          }
          textResponse += `\n${result.chunk}\n\n---\n\n`;
        }

        return {
          content: [{ type: 'text', text: textResponse }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{ type: 'text', text: `Search failed: ${output.error}` }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: get-project-details
  server.registerTool(
    'get-project-details',
    {
      title: 'Get Project Details',
      description: 'Get detailed information about a specific project including its tech stack, commands, and description',
      inputSchema: {
        projectName: z.string().describe('Name of the project to get details for')
      },
      outputSchema: {
        success: z.boolean(),
        project: z.object({
          name: z.string(),
          techStack: z.array(z.string()),
          commands: z.array(z.string()),
          description: z.string(),
          language: z.string(),
          framework: z.string().optional()
        }).optional(),
        error: z.string().optional()
      }
    },
    async ({ projectName }) => {
      try {
        const apiClient = getAPIClient();

        // Search for the specific project
        const response = await fetch(`${apiClient.getBaseUrl()}/api/knowledge/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: projectName,
            topK: 10,
            filters: { projectNames: [projectName] }
          })
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || data.results.length === 0) {
          throw new Error(`Project "${projectName}" not found in knowledge base`);
        }

        // Aggregate information from all chunks
        const firstResult = data.results[0];
        const allChunks = data.results.map((r: any) => r.chunk).join('\n\n');

        const project = {
          name: firstResult.projectName,
          techStack: firstResult.metadata?.techStack || [],
          commands: firstResult.metadata?.commands || [],
          description: firstResult.metadata?.description || '',
          language: firstResult.metadata?.language || 'unknown',
          framework: firstResult.metadata?.framework
        };

        const output = { success: true, project };

        let textResponse = `# ${project.name}\n\n`;
        textResponse += `**Language:** ${project.language}\n`;
        if (project.framework) {
          textResponse += `**Framework:** ${project.framework}\n`;
        }
        if (project.techStack.length > 0) {
          textResponse += `**Tech Stack:** ${project.techStack.join(', ')}\n`;
        }
        if (project.commands.length > 0) {
          textResponse += `\n**Commands:**\n`;
          for (const cmd of project.commands.slice(0, 10)) {
            textResponse += `- \`${cmd}\`\n`;
          }
        }
        if (project.description) {
          textResponse += `\n**Description:**\n${project.description}\n`;
        }
        textResponse += `\n**Content Preview:**\n${allChunks.slice(0, 1500)}...`;

        return {
          content: [{ type: 'text', text: textResponse }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{ type: 'text', text: `Failed to get project details: ${output.error}` }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: index-projects
  server.registerTool(
    'index-projects',
    {
      title: 'Index Projects',
      description: 'Trigger indexing of projects to update the knowledge base. Use this when projects have been updated or to perform initial indexing.',
      inputSchema: {
        action: z.enum(['index-all', 'reindex-project', 'clear']).default('index-all')
          .describe('Action: index-all (full index), reindex-project (single project), clear (remove all)'),
        projectName: z.string().optional().describe('Project name (required for reindex-project action)')
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string().optional(),
        totalDocuments: z.number().optional(),
        totalProjects: z.number().optional(),
        error: z.string().optional()
      }
    },
    async ({ action, projectName }) => {
      try {
        const apiClient = getAPIClient();

        const body: any = { action };
        if (projectName) {
          body.projectName = projectName;
        }

        const response = await fetch(`${apiClient.getBaseUrl()}/api/knowledge/index`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          throw new Error(`Index API returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Indexing failed');
        }

        const output = {
          success: true,
          message: data.message || `Indexed ${data.totalDocuments} documents from ${data.totalProjects} projects`,
          totalDocuments: data.totalDocuments,
          totalProjects: data.totalProjects
        };

        return {
          content: [{
            type: 'text',
            text: `✅ ${output.message}`
          }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{ type: 'text', text: `Indexing failed: ${output.error}` }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: tailor-resume-with-projects
  server.registerTool(
    'tailor-resume-with-projects',
    {
      title: 'RAG-Based Resume Tailoring',
      description: 'Tailor a resume for a job description using the project knowledge base. This uses RAG (Retrieval Augmented Generation) to find relevant projects and optimize the resume.',
      inputSchema: {
        jobDescription: z.string().describe('The job description or requirements'),
        resumeLatex: z.string().describe('The LaTeX resume content to tailor'),
        focusAreas: z.array(z.string()).optional()
          .describe('Specific areas to focus on (e.g., ["AI", "React", "Python"])'),
        topK: z.number().optional().default(5)
          .describe('Number of project chunks to retrieve (default: 5)')
      },
      outputSchema: {
        success: z.boolean(),
        tailoredResume: z.string().optional(),
        changes: z.array(z.object({
          type: z.enum(['added', 'modified', 'deleted']),
          section: z.string(),
          description: z.string(),
          reasoning: z.string()
        })).optional(),
        relevantProjects: z.array(z.object({
          projectName: z.string(),
          score: z.number(),
          techStack: z.array(z.string())
        })).optional(),
        error: z.string().optional()
      }
    },
    async ({ jobDescription, resumeLatex, focusAreas, topK = 5 }) => {
      try {
        const apiClient = getAPIClient();

        const response = await fetch(`${apiClient.getBaseUrl()}/api/knowledge/tailor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobDescription,
            resumeLatex,
            focusAreas,
            topK
          })
        });

        if (!response.ok) {
          throw new Error(`Tailor API returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Tailoring failed');
        }

        const output = {
          success: true,
          tailoredResume: data.tailoredResume,
          changes: data.changes,
          relevantProjects: data.relevantProjects
        };

        // Build text response
        let textResponse = '# Resume Tailoring Complete\n\n';

        if (data.relevantProjects?.length > 0) {
          textResponse += '## Relevant Projects Found:\n';
          for (const proj of data.relevantProjects) {
            textResponse += `- **${proj.projectName}** (Score: ${Math.round(proj.score * 100) / 100})\n`;
            if (proj.techStack?.length > 0) {
              textResponse += `  Tech: ${proj.techStack.join(', ')}\n`;
            }
          }
          textResponse += '\n';
        }

        if (data.changes?.length > 0) {
          textResponse += '## Changes Made:\n';
          for (const change of data.changes) {
            textResponse += `- **[${change.type.toUpperCase()}]** ${change.section}: ${change.description}\n`;
            textResponse += `  _Reasoning: ${change.reasoning}_\n`;
          }
          textResponse += '\n';
        }

        if (data.reasoning) {
          textResponse += `## Strategy:\n${data.reasoning}\n\n`;
        }

        textResponse += '## Tailored Resume:\n```latex\n';
        textResponse += data.tailoredResume.slice(0, 2000);
        if (data.tailoredResume.length > 2000) {
          textResponse += '\n... (truncated)';
        }
        textResponse += '\n```';

        return {
          content: [{ type: 'text', text: textResponse }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{ type: 'text', text: `Resume tailoring failed: ${output.error}` }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: get-knowledge-status
  server.registerTool(
    'get-knowledge-status',
    {
      title: 'Get Knowledge Base Status',
      description: 'Get the current status of the project knowledge base including indexed projects and documents',
      inputSchema: {},
      outputSchema: {
        success: z.boolean(),
        status: z.object({
          totalDocuments: z.number(),
          totalProjects: z.number(),
          lastIndexedAt: z.string(),
          availableProjects: z.number(),
          unindexedProjects: z.number()
        }).optional(),
        error: z.string().optional()
      }
    },
    async () => {
      try {
        const apiClient = getAPIClient();

        const response = await fetch(`${apiClient.getBaseUrl()}/api/knowledge/status`);

        if (!response.ok) {
          throw new Error(`Status API returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to get status');
        }

        const output = {
          success: true,
          status: data.status
        };

        let textResponse = '# Knowledge Base Status\n\n';
        textResponse += `**Total Documents:** ${data.status.totalDocuments}\n`;
        textResponse += `**Indexed Projects:** ${data.status.totalProjects}\n`;
        textResponse += `**Available Projects:** ${data.status.availableProjects}\n`;
        textResponse += `**Unindexed Projects:** ${data.status.unindexedProjects}\n`;
        textResponse += `**Last Indexed:** ${data.status.lastIndexedAt}\n`;

        if (data.projectStats?.length > 0) {
          textResponse += '\n## Indexed Projects:\n';
          for (const proj of data.projectStats.slice(0, 20)) {
            textResponse += `- ${proj.projectName}: ${proj.documentCount} documents\n`;
          }
        }

        if (data.unindexedProjects?.length > 0) {
          textResponse += '\n## Unindexed Projects:\n';
          for (const proj of data.unindexedProjects.slice(0, 10)) {
            textResponse += `- ${proj}\n`;
          }
        }

        return {
          content: [{ type: 'text', text: textResponse }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{ type: 'text', text: `Failed to get status: ${output.error}` }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );
}
