/**
 * File System Client for MCP Server
 *
 * Handles file operations on the actual file system (not browser IndexedDB).
 * This allows the MCP server to work with real .tex files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MCPConfig } from '../config';

export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  createdAt: number;
  modifiedAt: number;
  isPinned: boolean;
  content?: string;
}

export class FileSystemClient {
  private baseDir: string;
  private metadataFile: string;

  constructor(baseDir?: string) {
    // Default to a 'resume-files' directory in the project
    this.baseDir = baseDir || path.join(process.cwd(), 'resume-files');
    this.metadataFile = path.join(this.baseDir, '.metadata.json');
  }

  /**
   * Initialize the file system client
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(this.baseDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.baseDir, { recursive: true });

      // Create a sample resume file if directory is empty
      const samplePath = path.join(this.baseDir, 'resume.tex');
      const { DEFAULT_RESUME_TEMPLATE } = await import('../../lib/latex-utils');
      await fs.writeFile(samplePath, DEFAULT_RESUME_TEMPLATE);

      // Initialize metadata
      await this.saveMetadata([{
        id: 'sample-resume',
        name: 'resume.tex',
        path: '/resume.tex',
        type: 'file',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        isPinned: true
      }]);
    }
  }

  /**
   * Get all file metadata
   */
  async getAllMetadata(): Promise<FileMetadata[]> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Save metadata
   */
  async saveMetadata(metadata: FileMetadata[]): Promise<void> {
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string): Promise<FileMetadata | null> {
    const metadata = await this.getAllMetadata();
    const fileMeta = metadata.find(m => m.id === fileId);

    if (!fileMeta) return null;

    // Read content if it's a file
    if (fileMeta.type === 'file') {
      const fullPath = path.join(this.baseDir, fileMeta.name);
      try {
        fileMeta.content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        fileMeta.content = '';
      }
    }

    return fileMeta;
  }

  /**
   * Get file by name
   */
  async getFileByName(filename: string): Promise<FileMetadata | null> {
    const metadata = await this.getAllMetadata();
    const fileMeta = metadata.find(m => m.name === filename);

    if (!fileMeta) return null;

    // Read content if it's a file
    if (fileMeta.type === 'file') {
      const fullPath = path.join(this.baseDir, fileMeta.name);
      try {
        fileMeta.content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        fileMeta.content = '';
      }
    }

    return fileMeta;
  }

  /**
   * Get all files
   */
  async getAllFiles(): Promise<FileMetadata[]> {
    const metadata = await this.getAllMetadata();
    return metadata.filter(m => m.type === 'file');
  }

  /**
   * Get pinned files
   */
  async getPinnedFiles(): Promise<FileMetadata[]> {
    const allFiles = await this.getAllFiles();
    return allFiles.filter(f => f.isPinned);
  }

  /**
   * Create a new file
   */
  async createFile(name: string, content: string = '', parentPath: string = '/'): Promise<FileMetadata> {
    // Ensure .tex extension
    if (!name.endsWith('.tex')) {
      name = `${name}.tex`;
    }

    const fullPath = path.join(this.baseDir, name);
    const id = this.generateId();
    const now = Date.now();

    // Write file
    await fs.writeFile(fullPath, content);

    // Update metadata
    const metadata = await this.getAllMetadata();
    const newFile: FileMetadata = {
      id,
      name,
      path: `/${name}`,
      type: 'file',
      createdAt: now,
      modifiedAt: now,
      isPinned: false
    };

    metadata.push(newFile);
    await this.saveMetadata(metadata);

    return { ...newFile, content };
  }

  /**
   * Update file content
   */
  async updateFile(fileId: string, content: string): Promise<FileMetadata> {
    const metadata = await this.getAllMetadata();
    const fileIndex = metadata.findIndex(m => m.id === fileId);

    if (fileIndex === -1) {
      throw new Error(`File with ID ${fileId} not found`);
    }

    const fileMeta = metadata[fileIndex];
    const fullPath = path.join(this.baseDir, fileMeta.name);

    // Write updated content
    await fs.writeFile(fullPath, content);

    // Update metadata
    fileMeta.modifiedAt = Date.now();
    await this.saveMetadata(metadata);

    return { ...fileMeta, content };
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const metadata = await this.getAllMetadata();
    const fileIndex = metadata.findIndex(m => m.id === fileId);

    if (fileIndex === -1) {
      return false;
    }

    const fileMeta = metadata[fileIndex];
    const fullPath = path.join(this.baseDir, fileMeta.name);

    // Delete file
    try {
      await fs.unlink(fullPath);
    } catch {
      // File might not exist, continue
    }

    // Update metadata
    metadata.splice(fileIndex, 1);
    await this.saveMetadata(metadata);

    return true;
  }

  /**
   * Rename a file
   */
  async renameFile(fileId: string, newName: string): Promise<FileMetadata> {
    const metadata = await this.getAllMetadata();
    const fileIndex = metadata.findIndex(m => m.id === fileId);

    if (fileIndex === -1) {
      throw new Error(`File with ID ${fileId} not found`);
    }

    const fileMeta = metadata[fileIndex];
    const oldPath = path.join(this.baseDir, fileMeta.name);

    // Ensure .tex extension
    if (!newName.endsWith('.tex')) {
      newName = `${newName}.tex`;
    }

    const newPath = path.join(this.baseDir, newName);

    // Rename file
    await fs.rename(oldPath, newPath);

    // Update metadata
    fileMeta.name = newName;
    fileMeta.path = `/${newName}`;
    fileMeta.modifiedAt = Date.now();
    await this.saveMetadata(metadata);

    return fileMeta;
  }

  /**
   * Toggle pin status
   */
  async togglePin(fileId: string): Promise<FileMetadata> {
    const metadata = await this.getAllMetadata();
    const fileIndex = metadata.findIndex(m => m.id === fileId);

    if (fileIndex === -1) {
      throw new Error(`File with ID ${fileId} not found`);
    }

    const fileMeta = metadata[fileIndex];
    fileMeta.isPinned = !fileMeta.isPinned;
    await this.saveMetadata(metadata);

    return fileMeta;
  }

  /**
   * List all files in the directory
   */
  async listDirectory(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      return files.filter(f => f.endsWith('.tex') && !f.startsWith('.'));
    } catch {
      return [];
    }
  }

  /**
   * Get the base directory path
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let clientInstance: FileSystemClient | null = null;

export function getFileSystemClient(): FileSystemClient {
  if (!clientInstance) {
    clientInstance = new FileSystemClient();
  }
  return clientInstance;
}
