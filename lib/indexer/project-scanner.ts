/**
 * Project scanner - scans /Projects directory for indexable files
 */

import fs from 'fs/promises';
import path from 'path';
import { DocumentType, ProjectScanResult, ProjectMetadata } from '../vector-db/schemas';
import {
  detectDocumentType,
  parsePackageJson,
  parsePyprojectToml,
  parseMakefile,
  parseClaudeMd,
  parseReadmeMd,
  mergeMetadata,
} from './document-parser';

// Files to index in each project
const INDEXABLE_FILES = [
  'CLAUDE.md',
  'README.md',
  'package.json',
  'pyproject.toml',
  'Makefile',
];

// Directories to skip
const SKIP_DIRECTORIES = [
  'node_modules',
  '.git',
  '.next',
  '__pycache__',
  'dist',
  'build',
  '.venv',
  'venv',
  '.cache',
  'coverage',
];

/**
 * Check if a directory is a valid project (not a system/hidden directory)
 */
async function isValidProject(dirPath: string): Promise<boolean> {
  const dirName = path.basename(dirPath);

  // Skip hidden directories and common non-project directories
  if (dirName.startsWith('.')) return false;
  if (SKIP_DIRECTORIES.includes(dirName)) return false;

  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) return false;

    // Check if it has any indexable files
    const files = await fs.readdir(dirPath);
    return files.some((f) =>
      INDEXABLE_FILES.some((indexable) =>
        f.toLowerCase() === indexable.toLowerCase()
      )
    );
  } catch {
    return false;
  }
}

/**
 * Get file stats
 */
async function getFileInfo(filePath: string): Promise<{
  size: number;
  modifiedAt: string;
} | null> {
  try {
    const stat = await fs.stat(filePath);
    return {
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Read file content safely
 */
export async function readFileContent(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

/**
 * Scan a single project directory
 */
export async function scanProject(projectPath: string): Promise<ProjectScanResult | null> {
  const projectName = path.basename(projectPath);

  try {
    const files = await fs.readdir(projectPath);
    const projectFiles: ProjectScanResult['files'] = [];
    const metadataSources: Partial<ProjectMetadata>[] = [];

    for (const fileName of files) {
      // Check if this is an indexable file
      const matchedIndexable = INDEXABLE_FILES.find(
        (f) => f.toLowerCase() === fileName.toLowerCase()
      );

      if (!matchedIndexable) continue;

      const filePath = path.join(projectPath, fileName);
      const fileInfo = await getFileInfo(filePath);

      if (!fileInfo) continue;

      const fileType = detectDocumentType(filePath);

      projectFiles.push({
        path: filePath,
        type: fileType,
        size: fileInfo.size,
        modifiedAt: fileInfo.modifiedAt,
      });

      // Parse file for metadata
      const content = await readFileContent(filePath);
      if (content) {
        let metadata: Partial<ProjectMetadata> = {};

        switch (fileType) {
          case 'package_json':
            metadata = parsePackageJson(content);
            break;
          case 'pyproject':
            metadata = parsePyprojectToml(content);
            break;
          case 'makefile':
            metadata = parseMakefile(content);
            break;
          case 'claude_md':
            metadata = parseClaudeMd(content);
            break;
          case 'readme':
            metadata = parseReadmeMd(content);
            break;
        }

        metadataSources.push(metadata);
      }
    }

    // If no indexable files found, skip this project
    if (projectFiles.length === 0) {
      return null;
    }

    // Merge all metadata sources
    const mergedMetadata = mergeMetadata(...metadataSources);

    return {
      projectName,
      projectPath,
      files: projectFiles,
      metadata: mergedMetadata,
    };
  } catch (error) {
    console.error(`Failed to scan project ${projectPath}:`, error);
    return null;
  }
}

/**
 * Scan all projects in a directory
 */
export async function scanProjectsDirectory(
  baseDir: string
): Promise<ProjectScanResult[]> {
  const results: ProjectScanResult[] = [];

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectPath = path.join(baseDir, entry.name);

      if (!(await isValidProject(projectPath))) continue;

      const scanResult = await scanProject(projectPath);
      if (scanResult) {
        results.push(scanResult);
      }
    }

    console.log(`Scanned ${results.length} projects in ${baseDir}`);
    return results;
  } catch (error) {
    console.error(`Failed to scan directory ${baseDir}:`, error);
    throw new Error(`Failed to scan directory: ${baseDir}`);
  }
}

/**
 * Get default projects directory path
 */
export function getDefaultProjectsPath(): string {
  // Default to /Users/stranzersweb/Projects
  return '/Users/stranzersweb/Projects';
}

/**
 * List all project names in a directory
 */
export async function listProjectNames(baseDir?: string): Promise<string[]> {
  const dir = baseDir || getDefaultProjectsPath();

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const projectNames: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectPath = path.join(dir, entry.name);

      if (await isValidProject(projectPath)) {
        projectNames.push(entry.name);
      }
    }

    return projectNames.sort();
  } catch (error) {
    console.error(`Failed to list projects in ${dir}:`, error);
    return [];
  }
}
