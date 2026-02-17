/**
 * Resources for MCP Server
 *
 * Resources provide read-only access to templates, files, and system state
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getFileSystemClient, getAPIClient } from '../integrations';

/**
 * Register all resources with the MCP server
 */
export function registerResources(server: McpServer): void {

  // Resource: Default resume template
  server.registerResource(
    'default-template',
    'resume://templates/default',
    {
      title: 'Default Resume Template',
      description: 'Professional LaTeX resume template with custom formatting',
      mimeType: 'application/x-latex'
    },
    async (uri) => {
      const { DEFAULT_RESUME_TEMPLATE } = await import('../../lib/latex-utils');
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/x-latex',
          text: DEFAULT_RESUME_TEMPLATE
        }]
      };
    }
  );

  // Resource: Simple template
  server.registerResource(
    'simple-template',
    'resume://templates/simple',
    {
      title: 'Simple Document Template',
      description: 'Basic LaTeX document template',
      mimeType: 'application/x-latex'
    },
    async (uri) => {
      const { SIMPLE_TEMPLATE } = await import('../../lib/latex-utils');
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/x-latex',
          text: SIMPLE_TEMPLATE
        }]
      };
    }
  );

  // Resource: All files
  server.registerResource(
    'all-files',
    'resume://files/all',
    {
      title: 'All Resume Files',
      description: 'List of all LaTeX files in the system'
    },
    async (uri) => {
      const fileClient = getFileSystemClient();
      await fileClient.initialize();

      const files = await fileClient.getAllFiles();

      const fileList = files.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        createdAt: new Date(f.createdAt).toISOString(),
        modifiedAt: new Date(f.modifiedAt).toISOString(),
        isPinned: f.isPinned
      }));

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(fileList, null, 2)
        }]
      };
    }
  );

  // Resource: Pinned files
  server.registerResource(
    'pinned-files',
    'resume://files/pinned',
    {
      title: 'Pinned Resume Files',
      description: 'List of pinned LaTeX files for quick access'
    },
    async (uri) => {
      const fileClient = getFileSystemClient();
      await fileClient.initialize();

      const files = await fileClient.getPinnedFiles();

      const fileList = files.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        createdAt: new Date(f.createdAt).toISOString(),
        modifiedAt: new Date(f.modifiedAt).toISOString()
      }));

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(fileList, null, 2)
        }]
      };
    }
  );

  // Resource: Specific file by ID (dynamic)
  server.registerResource(
    'file-by-id',
    new ResourceTemplate('resume://files/{fileId}', { list: undefined }),
    {
      title: 'Resume File Content',
      description: 'Access specific LaTeX file content by ID'
    },
    async (uri, { fileId }) => {
      const fileClient = getFileSystemClient();
      await fileClient.initialize();

      const file = await fileClient.getFile(fileId as string);

      if (!file) {
        throw new Error(`File with ID "${fileId}" not found`);
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/x-latex',
          text: file.content || '',
          // Also include metadata as JSON
        }, {
          uri: `${uri.href}/metadata`,
          mimeType: 'application/json',
          text: JSON.stringify({
            id: file.id,
            name: file.name,
            path: file.path,
            type: file.type,
            createdAt: new Date(file.createdAt).toISOString(),
            modifiedAt: new Date(file.modifiedAt).toISOString(),
            isPinned: file.isPinned
          }, null, 2)
        }]
      };
    }
  );

  // Resource: LaTeX installation status
  server.registerResource(
    'latex-status',
    'resume://system/latex-status',
    {
      title: 'LaTeX Installation Status',
      description: 'Check if LaTeX is installed and get version information'
    },
    async (uri) => {
      const apiClient = getAPIClient();
      const status = await apiClient.checkLatexInstallation();

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            available: status.available,
            path: status.path,
            version: status.version,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  );

  // Resource: Recommended LaTeX packages
  server.registerResource(
    'recommended-packages',
    'resume://packages/recommended',
    {
      title: 'Recommended LaTeX Packages',
      description: 'List of recommended LaTeX packages for resume formatting'
    },
    async (uri) => {
      const { getResumePackages } = await import('../../lib/latex-utils');
      const packages = getResumePackages();

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            packages,
            count: packages.length,
            description: 'Recommended packages for professional resume formatting'
          }, null, 2)
        }]
      };
    }
  );

  // Resource: System information
  server.registerResource(
    'system-info',
    'resume://system/info',
    {
      title: 'System Information',
      description: 'Get information about the resume editor system'
    },
    async (uri) => {
      const fileClient = getFileSystemClient();
      await fileClient.initialize();

      const files = await fileClient.getAllFiles();
      const apiClient = getAPIClient();
      const latexStatus = await apiClient.checkLatexInstallation();

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            fileSystem: {
              baseDirectory: fileClient.getBaseDir(),
              totalFiles: files.length,
              pinnedFiles: files.filter(f => f.isPinned).length
            },
            latex: {
              available: latexStatus.available,
              version: latexStatus.version
            },
            api: {
              baseUrl: apiClient.getBaseUrl()
            },
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  );
}
