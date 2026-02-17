/**
 * Next.js API Client for MCP Server
 *
 * Handles communication with Next.js API routes (primarily for LaTeX compilation)
 */

import { MCPConfig } from '../config';

export interface CompilationResult {
  success: boolean;
  pdfUrl?: string;
  compilationMethod?: string;
  filename?: string;
  error?: string;
  latexAvailable?: boolean;
  suggestion?: string;
  logs?: string;
  installInstructions?: {
    macos: string;
    linux: string;
    windows: string;
  };
}

export interface LatexCheckResult {
  available: boolean;
  path?: string;
  version?: string;
}

export class NextAPIClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || MCPConfig.network.nextJsApiUrl;
  }

  /**
   * Check if LaTeX is installed on the system
   */
  async checkLatexInstallation(): Promise<LatexCheckResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/latex-check`, {
        method: 'GET',
      });

      if (!response.ok) {
        return { available: false };
      }

      const data = await response.json();

      // The API returns { status, checks, recommendations }
      // We need to extract the latex info from checks
      return {
        available: data.checks?.latex?.installed || false,
        path: data.checks?.latex?.path || undefined,
        version: data.checks?.latex?.version || undefined,
      };
    } catch (error) {
      console.error('Error checking LaTeX installation:', error);
      return { available: false };
    }
  }

  /**
   * Compile LaTeX to PDF
   */
  async compileLatex(
    content: string,
    filename: string = 'document.pdf',
    useOnline: boolean = false
  ): Promise<CompilationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          filename,
          useOnline,
        }),
      });

      const result = await response.json();

      // Check if the server is running
      if (!response.ok && response.status === 0) {
        throw new Error(
          `Cannot connect to Next.js server at ${this.baseUrl}. ` +
          'Make sure the Next.js development server is running (npm run dev)'
        );
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
          suggestion: 'Ensure Next.js server is running on port 3000',
        };
      }
      return {
        success: false,
        error: 'Unknown error occurred during compilation',
      };
    }
  }

  /**
   * Compile LaTeX with local compiler
   */
  async compileLocal(content: string, filename?: string): Promise<CompilationResult> {
    return this.compileLatex(content, filename, false);
  }

  /**
   * Compile LaTeX with online compiler
   */
  async compileOnline(content: string, filename?: string): Promise<CompilationResult> {
    return this.compileLatex(content, filename, true);
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/latex-check`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Singleton instance
let apiClientInstance: NextAPIClient | null = null;

export function getAPIClient(): NextAPIClient {
  if (!apiClientInstance) {
    apiClientInstance = new NextAPIClient();
  }
  return apiClientInstance;
}
