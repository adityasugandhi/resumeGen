/**
 * Integration Layer Index
 *
 * Exports all integration clients for the MCP server
 */

export { FileSystemClient, getFileSystemClient } from './file-system-client';
export type { FileMetadata } from './file-system-client';

export { NextAPIClient, getAPIClient } from './api-client';
export type { CompilationResult, LatexCheckResult } from './api-client';
