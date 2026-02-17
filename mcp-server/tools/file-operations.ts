/**
 * File Operation Tools for MCP Server
 *
 * Tools for creating, updating, deleting, renaming, and managing LaTeX files
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getFileSystemClient } from '../integrations';

/**
 * Register all file operation tools with the MCP server
 */
export function registerFileOperationTools(server: McpServer): void {

  // Tool: create-file
  server.registerTool(
    'create-file',
    {
      title: 'Create LaTeX File',
      description: 'Create a new .tex file with optional initial content',
      inputSchema: {
        name: z.string().describe('Name of the file (automatically adds .tex extension)'),
        content: z.string().optional().describe('Initial LaTeX content for the file'),
        template: z.enum(['default', 'simple', 'empty']).optional().default('empty')
          .describe('Template to use: default (resume), simple (basic document), or empty')
      },
      outputSchema: {
        success: z.boolean(),
        fileId: z.string().optional(),
        fileName: z.string().optional(),
        path: z.string().optional(),
        error: z.string().optional()
      }
    },
    async ({ name, content, template = 'empty' }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        // Get template content if needed
        let fileContent = content || '';
        if (!content && template !== 'empty') {
          const { DEFAULT_RESUME_TEMPLATE, SIMPLE_TEMPLATE } = await import('../../lib/latex-utils');
          fileContent = template === 'default' ? DEFAULT_RESUME_TEMPLATE : SIMPLE_TEMPLATE;
        }

        const newFile = await fileClient.createFile(name, fileContent);

        const output = {
          success: true,
          fileId: newFile.id,
          fileName: newFile.name,
          path: newFile.path
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2)
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
            text: JSON.stringify(output, null, 2)
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: update-file
  server.registerTool(
    'update-file',
    {
      title: 'Update File Content',
      description: 'Update the content of an existing LaTeX file',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to update'),
        fileName: z.string().optional().describe('Name of the file to update (alternative to fileId)'),
        content: z.string().describe('New LaTeX content for the file')
      },
      outputSchema: {
        success: z.boolean(),
        fileId: z.string().optional(),
        fileName: z.string().optional(),
        modifiedAt: z.string().optional(),
        error: z.string().optional()
      }
    },
    async ({ fileId, fileName, content }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        // Get file by ID or name
        let targetFileId = fileId;
        if (!targetFileId && fileName) {
          const file = await fileClient.getFileByName(fileName);
          if (!file) {
            throw new Error(`File "${fileName}" not found`);
          }
          targetFileId = file.id;
        }

        if (!targetFileId) {
          throw new Error('Either fileId or fileName must be provided');
        }

        const updatedFile = await fileClient.updateFile(targetFileId, content);

        const output = {
          success: true,
          fileId: updatedFile.id,
          fileName: updatedFile.name,
          modifiedAt: new Date(updatedFile.modifiedAt).toISOString()
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2)
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
            text: JSON.stringify(output, null, 2)
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: delete-file
  server.registerTool(
    'delete-file',
    {
      title: 'Delete File',
      description: 'Delete a LaTeX file from the system',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to delete'),
        fileName: z.string().optional().describe('Name of the file to delete (alternative to fileId)')
      },
      outputSchema: {
        success: z.boolean(),
        deletedFileName: z.string().optional(),
        error: z.string().optional()
      }
    },
    async ({ fileId, fileName }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        // Get file by ID or name
        let targetFileId = fileId;
        let targetFileName = fileName;

        if (!targetFileId && fileName) {
          const file = await fileClient.getFileByName(fileName);
          if (!file) {
            throw new Error(`File "${fileName}" not found`);
          }
          targetFileId = file.id;
          targetFileName = file.name;
        } else if (targetFileId && !targetFileName) {
          const file = await fileClient.getFile(targetFileId);
          if (file) {
            targetFileName = file.name;
          }
        }

        if (!targetFileId) {
          throw new Error('Either fileId or fileName must be provided');
        }

        const deleted = await fileClient.deleteFile(targetFileId);

        if (!deleted) {
          throw new Error('File could not be deleted');
        }

        const output = {
          success: true,
          deletedFileName: targetFileName
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2)
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
            text: JSON.stringify(output, null, 2)
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: rename-file
  server.registerTool(
    'rename-file',
    {
      title: 'Rename File',
      description: 'Rename an existing LaTeX file',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to rename'),
        fileName: z.string().optional().describe('Current name of the file (alternative to fileId)'),
        newName: z.string().describe('New name for the file (automatically adds .tex extension)')
      },
      outputSchema: {
        success: z.boolean(),
        oldName: z.string().optional(),
        newName: z.string().optional(),
        path: z.string().optional(),
        error: z.string().optional()
      }
    },
    async ({ fileId, fileName, newName }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        // Get file by ID or name
        let targetFileId = fileId;
        let oldName = fileName;

        if (!targetFileId && fileName) {
          const file = await fileClient.getFileByName(fileName);
          if (!file) {
            throw new Error(`File "${fileName}" not found`);
          }
          targetFileId = file.id;
          oldName = file.name;
        } else if (targetFileId && !oldName) {
          const file = await fileClient.getFile(targetFileId);
          if (file) {
            oldName = file.name;
          }
        }

        if (!targetFileId) {
          throw new Error('Either fileId or fileName must be provided');
        }

        const renamedFile = await fileClient.renameFile(targetFileId, newName);

        const output = {
          success: true,
          oldName,
          newName: renamedFile.name,
          path: renamedFile.path
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2)
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
            text: JSON.stringify(output, null, 2)
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: toggle-pin
  server.registerTool(
    'toggle-pin',
    {
      title: 'Toggle File Pin',
      description: 'Pin or unpin a file for quick access',
      inputSchema: {
        fileId: z.string().optional().describe('ID of the file to pin/unpin'),
        fileName: z.string().optional().describe('Name of the file to pin/unpin (alternative to fileId)')
      },
      outputSchema: {
        success: z.boolean(),
        fileName: z.string().optional(),
        isPinned: z.boolean().optional(),
        error: z.string().optional()
      }
    },
    async ({ fileId, fileName }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        // Get file by ID or name
        let targetFileId = fileId;

        if (!targetFileId && fileName) {
          const file = await fileClient.getFileByName(fileName);
          if (!file) {
            throw new Error(`File "${fileName}" not found`);
          }
          targetFileId = file.id;
        }

        if (!targetFileId) {
          throw new Error('Either fileId or fileName must be provided');
        }

        const updatedFile = await fileClient.togglePin(targetFileId);

        const output = {
          success: true,
          fileName: updatedFile.name,
          isPinned: updatedFile.isPinned
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2)
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
            text: JSON.stringify(output, null, 2)
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );

  // Tool: list-files
  server.registerTool(
    'list-files',
    {
      title: 'List All Files',
      description: 'List all LaTeX files in the system',
      inputSchema: {
        pinnedOnly: z.boolean().optional().default(false).describe('Only list pinned files')
      },
      outputSchema: {
        success: z.boolean(),
        files: z.array(z.object({
          id: z.string(),
          name: z.string(),
          path: z.string(),
          createdAt: z.string(),
          modifiedAt: z.string(),
          isPinned: z.boolean()
        })).optional(),
        count: z.number().optional(),
        error: z.string().optional()
      }
    },
    async ({ pinnedOnly = false }) => {
      try {
        const fileClient = getFileSystemClient();
        await fileClient.initialize();

        const files = pinnedOnly
          ? await fileClient.getPinnedFiles()
          : await fileClient.getAllFiles();

        const fileList = files.map(f => ({
          id: f.id,
          name: f.name,
          path: f.path,
          createdAt: new Date(f.createdAt).toISOString(),
          modifiedAt: new Date(f.modifiedAt).toISOString(),
          isPinned: f.isPinned
        }));

        const output = {
          success: true,
          files: fileList,
          count: fileList.length
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2)
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
            text: JSON.stringify(output, null, 2)
          }],
          structuredContent: output,
          isError: true
        };
      }
    }
  );
}
