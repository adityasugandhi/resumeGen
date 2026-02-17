import { exec } from 'child_process';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DockerCheckResult {
  installed: boolean;
  running: boolean;
  version?: string;
  error?: string;
}

export interface DockerImageCheckResult {
  available: boolean;
  imageId?: string;
  size?: string;
  needsPull?: boolean;
  error?: string;
}

/**
 * Check if Docker is installed and running
 */
export async function checkDockerInstallation(): Promise<DockerCheckResult> {
  try {
    // Check if Docker daemon is running
    await execAsync('docker ps', { timeout: 5000 });

    // Get Docker version
    try {
      const { stdout: versionOutput } = await execAsync('docker --version');
      const version = versionOutput.trim();

      return {
        installed: true,
        running: true,
        version
      };
    } catch {
      return {
        installed: true,
        running: true
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Docker not installed or not running
    if (errorMessage.includes('command not found') || errorMessage.includes('not recognized')) {
      return {
        installed: false,
        running: false,
        error: 'Docker is not installed'
      };
    }

    if (errorMessage.includes('Cannot connect to the Docker daemon')) {
      return {
        installed: true,
        running: false,
        error: 'Docker is installed but not running. Please start Docker Desktop.'
      };
    }

    return {
      installed: false,
      running: false,
      error: errorMessage
    };
  }
}

/**
 * Check if texlive/texlive Docker image is available
 */
export async function checkTexliveImage(tag: string = 'latest'): Promise<DockerImageCheckResult> {
  try {
    const imageName = `texlive/texlive:${tag}`;
    const { stdout } = await execAsync(`docker images ${imageName} --format "{{.ID}}|{{.Size}}"`, { timeout: 5000 });

    if (stdout.trim()) {
      const [imageId, size] = stdout.trim().split('|');
      return {
        available: true,
        imageId,
        size
      };
    }

    return {
      available: false,
      needsPull: true
    };
  } catch (error) {
    return {
      available: false,
      needsPull: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Pull texlive/texlive Docker image
 */
export async function pullTexliveImage(tag: string = 'latest'): Promise<{ success: boolean; error?: string }> {
  try {
    const imageName = `texlive/texlive:${tag}`;

    // 10 minute timeout for pulling large image
    await execAsync(`docker pull ${imageName}`, { timeout: 600000 });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to pull texlive image:', errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Ensure texlive image is available, pull if necessary
 */
export async function ensureTexliveImage(tag: string = 'latest', autoPull: boolean = false): Promise<DockerImageCheckResult> {
  const imageCheck = await checkTexliveImage(tag);

  if (imageCheck.available) {
    return imageCheck;
  }

  if (autoPull) {
    const pullResult = await pullTexliveImage(tag);

    if (pullResult.success) {
      // Re-check after pulling
      return await checkTexliveImage(tag);
    }

    return {
      available: false,
      needsPull: true,
      error: pullResult.error
    };
  }

  return imageCheck;
}

/**
 * Create a temporary directory for LaTeX compilation
 */
export async function createTempLatexDir(): Promise<string> {
  const prefix = 'latex-compile-';
  const dirPath = join(tmpdir(), prefix + Date.now());
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Clean up temporary directory
 */
export async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to cleanup temp directory:', dirPath, error);
    // Don't throw - cleanup failure shouldn't break the response
  }
}

/**
 * Write LaTeX content to temp directory
 */
export async function writeLatexFile(dirPath: string, content: string, filename: string = 'document.tex'): Promise<string> {
  const filePath = join(dirPath, filename);
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Read PDF from temp directory
 */
export async function readPdfFile(dirPath: string, basename: string = 'document'): Promise<Buffer> {
  const pdfPath = join(dirPath, `${basename}.pdf`);
  return await readFile(pdfPath);
}

/**
 * Read LaTeX log file for error parsing
 */
export async function readLogFile(dirPath: string, basename: string = 'document'): Promise<string | null> {
  try {
    const logPath = join(dirPath, `${basename}.log`);
    return await readFile(logPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Parse LaTeX errors from log content
 */
export function parseLatexLog(logContent: string): {
  hasErrors: boolean;
  errorType?: string;
  lineNumber?: number;
  message: string;
} {
  const lines = logContent.split('\n');

  // Common LaTeX error patterns
  const errorPatterns = [
    { pattern: /! Undefined control sequence/, type: 'Undefined Command' },
    { pattern: /! Missing \\begin{document}/, type: 'Missing \\begin{document}' },
    { pattern: /! LaTeX Error: Environment .* undefined/, type: 'Undefined Environment' },
    { pattern: /! Package .* Error/, type: 'Package Error' },
    { pattern: /! LaTeX Error/, type: 'LaTeX Error' },
    { pattern: /! Emergency stop/, type: 'Fatal Error' },
    { pattern: /^!/, type: 'Error' }
  ];

  let errorType: string | undefined;
  let lineNumber: number | undefined;
  let errorMessage: string | undefined;

  // Find first error
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for error patterns
    for (const { pattern, type } of errorPatterns) {
      if (pattern.test(line)) {
        errorType = type;
        errorMessage = line.replace(/^!\s*/, '').trim();

        // Look for line number in surrounding lines
        for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 5); j++) {
          const lineMatch = lines[j].match(/l\.(\d+)/);
          if (lineMatch) {
            lineNumber = parseInt(lineMatch[1], 10);
            break;
          }
        }

        break;
      }
    }

    if (errorType) break;
  }

  const hasErrors = errorType !== undefined;

  return {
    hasErrors,
    errorType,
    lineNumber,
    message: errorMessage || (hasErrors ? 'LaTeX compilation failed - check syntax' : 'Compilation successful')
  };
}

/**
 * Get installation instructions for Docker
 */
export function getDockerInstallInstructions() {
  return {
    macos: 'Download and install Docker Desktop from https://www.docker.com/products/docker-desktop',
    linux: 'Install Docker Engine: https://docs.docker.com/engine/install/',
    windows: 'Download and install Docker Desktop from https://www.docker.com/products/docker-desktop',
    general: 'After installing Docker, pull the LaTeX image with: docker pull texlive/texlive:latest'
  };
}
