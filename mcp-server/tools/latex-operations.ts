/**
 * LaTeX Operation Tools for MCP Server
 *
 * Tools for compiling, validating, and optimizing LaTeX documents
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getFileSystemClient, getAPIClient } from '../integrations';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Register all LaTeX operation tools with the MCP server
 */
export function registerLatexOperationTools(server: McpServer): void {

  // Tool: compile-latex
  server.registerTool(
    'compile-latex',
    {
      title: 'Compile LaTeX to PDF',
      description: 'Compile LaTeX source code to PDF using local or online compiler with intelligent fallback',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to compile'),
        fileName: z.string().optional().describe('Name of the file to compile (alternative to fileId)'),
        content: z.string().optional().describe('LaTeX content to compile (alternative to file reference)'),
        outputFileName: z.string().optional().describe('Name for the output PDF file'),
        useOnline: z.boolean().optional().default(false)
          .describe('Force online compilation (default: try local first, fallback to online)')
      },
      outputSchema: {
        success: z.boolean(),
        pdfUrl: z.string().optional().describe('Base64-encoded PDF data URL'),
        compilationMethod: z.string().optional().describe('Compilation method used (local/online)'),
        fileName: z.string().optional(),
        error: z.string().optional(),
        suggestion: z.string().optional(),
        latexAvailable: z.boolean().optional()
      }
    },
    async ({ fileId, fileName, content, outputFileName, useOnline = false }) => {
      try {
        const fileClient = getFileSystemClient();
        const apiClient = getAPIClient();

        await fileClient.initialize();

        // Get LaTeX content from file or use provided content
        let latexContent = content;
        let targetFileName = outputFileName || 'document.pdf';

        if (!latexContent) {
          if (fileId) {
            const file = await fileClient.getFile(fileId);
            if (!file) {
              throw new Error(`File with ID "${fileId}" not found`);
            }
            latexContent = file.content || '';
            targetFileName = outputFileName || file.name.replace('.tex', '.pdf');
          } else if (fileName) {
            const file = await fileClient.getFileByName(fileName);
            if (!file) {
              throw new Error(`File "${fileName}" not found`);
            }
            latexContent = file.content || '';
            targetFileName = outputFileName || fileName.replace('.tex', '.pdf');
          } else {
            throw new Error('Must provide either fileId, fileName, or content');
          }
        }

        if (!latexContent) {
          throw new Error('No LaTeX content to compile');
        }

        // Compile using the Next.js API
        const result = await apiClient.compileLatex(latexContent, targetFileName, useOnline);

        const output = {
          success: result.success,
          pdfUrl: result.pdfUrl,
          compilationMethod: result.compilationMethod,
          fileName: result.filename,
          error: result.error,
          suggestion: result.suggestion,
          latexAvailable: result.latexAvailable
        };

        return {
          content: [{
            type: 'text',
            text: result.success
              ? `Successfully compiled to PDF using ${result.compilationMethod}`
              : `Compilation failed: ${result.error}\n\nSuggestion: ${result.suggestion}`
          }],
          structuredContent: output,
          isError: !result.success
        };
      } catch (error) {
        const output = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        return {
          content: [{
            type: 'text',
            text: `Compilation error: ${output.error}`
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: validate-latex
  server.registerTool(
    'validate-latex',
    {
      title: 'Validate LaTeX Syntax',
      description: 'Validate LaTeX syntax before compilation to catch common errors',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to validate'),
        fileName: z.string().optional().describe('Name of the file to validate'),
        content: z.string().optional().describe('LaTeX content to validate')
      },
      outputSchema: {
        isValid: z.boolean(),
        errors: z.array(z.string()).optional(),
        warnings: z.array(z.string()).optional(),
        documentClass: z.string().optional(),
        packages: z.array(z.string()).optional()
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

        // Import validation utilities
        const {
          validateLatexSyntax,
          extractDocumentClass,
          getResumePackages
        } = await import('../../lib/latex-utils');

        const validation = validateLatexSyntax(latexContent);
        const documentClass = extractDocumentClass(latexContent);
        const warnings: string[] = [];

        // Check for recommended packages
        const recommendedPackages = getResumePackages();
        const usedPackages = latexContent.match(/\\usepackage(?:\[.*?\])?\{(.*?)\}/g)?.map(pkg => {
          const match = pkg.match(/\{(.*?)\}/);
          return match ? match[1] : '';
        }) || [];

        // Warn about missing recommended packages
        const missingPackages = recommendedPackages.filter(pkg => !usedPackages.includes(pkg));
        if (missingPackages.length > 0) {
          warnings.push(`Consider adding these packages for better resume formatting: ${missingPackages.slice(0, 3).join(', ')}`);
        }

        const output = {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings,
          documentClass: documentClass || 'unknown',
          packages: usedPackages
        };

        return {
          content: [{
            type: 'text',
            text: validation.isValid
              ? 'LaTeX syntax is valid'
              : `Found ${validation.errors.length} validation errors:\n${validation.errors.join('\n')}`
          }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          isValid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        };

        return {
          content: [{
            type: 'text',
            text: `Validation error: ${output.errors[0]}`
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: check-latex-installation
  server.registerTool(
    'check-latex-installation',
    {
      title: 'Check LaTeX Installation',
      description: 'Check if LaTeX is installed on the system and get version information',
      inputSchema: {},
      outputSchema: {
        available: z.boolean(),
        path: z.string().optional(),
        version: z.string().optional(),
        recommendation: z.string().optional()
      }
    },
    async () => {
      try {
        const apiClient = getAPIClient();
        const result = await apiClient.checkLatexInstallation();

        const output = {
          available: result.available,
          path: result.path,
          version: result.version,
          recommendation: result.available
            ? 'LaTeX is installed and ready to use for local compilation'
            : 'LaTeX is not installed. Install MacTeX (macOS), TeX Live (Linux), or MiKTeX (Windows) for local compilation. Online compilation is available as fallback.'
        };

        return {
          content: [{
            type: 'text',
            text: result.available
              ? `LaTeX is installed at ${result.path}\nVersion: ${result.version}`
              : 'LaTeX is not installed on this system. Online compilation will be used.'
          }],
          structuredContent: output
        };
      } catch (error) {
        const output = {
          available: false,
          recommendation: error instanceof Error ? error.message : 'Unable to check LaTeX installation'
        };

        return {
          content: [{
            type: 'text',
            text: 'Error checking LaTeX installation. Online compilation will be used.'
          }],
          structuredContent: output
        };
      }
    }
  );

  // Tool: export-pdf
  server.registerTool(
    'export-pdf',
    {
      title: 'Export PDF',
      description: 'Compile and save PDF to the file system',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to export'),
        fileName: z.string().optional().describe('Name of the file to export'),
        outputPath: z.string().optional().describe('Custom output path for the PDF')
      },
      outputSchema: {
        success: z.boolean(),
        outputPath: z.string().optional(),
        error: z.string().optional()
      }
    },
    async ({ fileId, fileName, outputPath }) => {
      try {
        const fileClient = getFileSystemClient();
        const apiClient = getAPIClient();

        await fileClient.initialize();

        // Get file
        let file;
        if (fileId) {
          file = await fileClient.getFile(fileId);
        } else if (fileName) {
          file = await fileClient.getFileByName(fileName);
        } else {
          throw new Error('Must provide either fileId or fileName');
        }

        if (!file || !file.content) {
          throw new Error('File not found or has no content');
        }

        // Compile
        const result = await apiClient.compileLatex(file.content, file.name.replace('.tex', '.pdf'));

        if (!result.success || !result.pdfUrl) {
          throw new Error(result.error || 'Compilation failed');
        }

        // Extract base64 data from data URL
        const base64Data = result.pdfUrl.replace(/^data:application\/pdf;base64,/, '');
        const pdfBuffer = Buffer.from(base64Data, 'base64');

        // Determine output path
        const finalOutputPath = outputPath || path.join(
          fileClient.getBaseDir(),
          file.name.replace('.tex', '.pdf')
        );

        // Save PDF
        await fs.writeFile(finalOutputPath, pdfBuffer);

        const output = {
          success: true,
          outputPath: finalOutputPath
        };

        return {
          content: [{
            type: 'text',
            text: `PDF successfully exported to: ${finalOutputPath}`
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
            text: `Export failed: ${output.error}`
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );
}
