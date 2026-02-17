/**
 * MCP Server Configuration
 *
 * Central configuration for the Resume MCP Server
 */

export const MCPConfig = {
  // Server Information
  server: {
    name: 'resume-editor-mcp',
    version: '1.0.0',
    description: 'MCP server for LaTeX Resume Editor with AI-powered tools'
  },

  // Network Configuration
  network: {
    port: parseInt(process.env.MCP_PORT || '3001'),
    host: process.env.MCP_HOST || 'localhost',
    nextJsApiUrl: process.env.NEXT_API_URL || 'http://localhost:3000'
  },

  // Feature Flags
  features: {
    enableAIAnalysis: true,
    enableLocalCompilation: true,
    enableOnlineCompilation: true,
    enableExport: true,
    enableCORS: true
  },

  // Paths
  paths: {
    errorLogs: process.cwd() + '/mcp-server/logs',
    tempFiles: process.cwd() + '/mcp-server/temp'
  },

  // Limits
  limits: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxCompilationTime: 30000, // 30 seconds
    maxConcurrentCompilations: 5
  }
} as const;

export type MCPConfigType = typeof MCPConfig;
