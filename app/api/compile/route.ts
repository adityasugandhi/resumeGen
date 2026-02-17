import { exec } from 'child_process';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';
import {
  checkDockerInstallation,
  ensureTexliveImage,
  createTempLatexDir,
  cleanupTempDir,
  writeLatexFile,
  readPdfFile,
  readLogFile,
  parseLatexLog,
  getDockerInstallInstructions
} from '@/lib/docker-utils';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 30;

// Default texlive Docker image tag
const TEXLIVE_IMAGE_TAG = 'latest';

// Parse LaTeX error logs to extract useful information (for online compilation)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseLatexErrors(errorOutput: string): { lineNumber?: number; errorType?: string; message: string } {
  const lines = errorOutput.split('\n');
  let lineNumber: number | undefined;
  let errorType: string | undefined;
  let message = errorOutput;

  // Common LaTeX error patterns
  const linePattern = /line (\d+)/i;
  const errorPatterns = [
    { pattern: /Undefined control sequence/, type: 'Undefined Command' },
    { pattern: /Missing \\begin{document}/, type: 'Missing \\begin{document}' },
    { pattern: /Environment .* undefined/, type: 'Undefined Environment' },
    { pattern: /Package .* Error/, type: 'Package Error' },
    { pattern: /LaTeX Error/, type: 'LaTeX Error' },
    { pattern: /Emergency stop/, type: 'Fatal Error' },
    { pattern: /!.*/, type: 'Error' }
  ];

  // Extract line number
  for (const line of lines) {
    const lineMatch = line.match(linePattern);
    if (lineMatch) {
      lineNumber = parseInt(lineMatch[1], 10);
      break;
    }
  }

  // Extract error type
  for (const { pattern, type } of errorPatterns) {
    if (pattern.test(errorOutput)) {
      errorType = type;
      break;
    }
  }

  // Extract concise error message (first error line)
  const errorLine = lines.find(line => line.startsWith('!'));
  if (errorLine) {
    message = errorLine.substring(1).trim();
  }

  return {
    lineNumber,
    errorType,
    message: message.substring(0, 500) // Limit message length
  };
}

// Compile using Docker with texlive/texlive image
async function compileWithDocker(content: string): Promise<Buffer> {
  let tempDir: string | null = null;

  try {
    // Create temporary directory for compilation
    tempDir = await createTempLatexDir();

    // Write LaTeX content to temp directory
    await writeLatexFile(tempDir, content);

    // Run Docker container with pdflatex
    // Mount temp directory, run 2-pass compilation, auto-remove container
    const dockerCommand = `docker run --rm -v "${tempDir}:/workspace" -w /workspace texlive/texlive:${TEXLIVE_IMAGE_TAG} pdflatex -interaction=nonstopmode -halt-on-error document.tex`;


    try {
      // First pass
      await execAsync(dockerCommand, { timeout: 30000 });

      // Second pass (for references, TOC, etc.)
      await execAsync(dockerCommand, { timeout: 30000 });

    } catch (execError) {
      // Read log file for detailed error information
      const logContent = await readLogFile(tempDir);

      if (logContent) {
        const parsedError = parseLatexLog(logContent);
        if (parsedError.hasErrors) {
          let errorMsg = parsedError.message;
          if (parsedError.errorType) {
            errorMsg = `${parsedError.errorType}: ${errorMsg}`;
          }
          if (parsedError.lineNumber) {
            errorMsg += ` (line ${parsedError.lineNumber})`;
          }
          throw new Error(errorMsg);
        }
      }

      // Fallback to generic error
      throw new Error(execError instanceof Error ? execError.message : 'Docker compilation failed');
    }

    // Read generated PDF
    const pdfBuffer = await readPdfFile(tempDir);

    if (pdfBuffer.length === 0) {
      throw new Error('Docker compilation produced empty PDF');
    }

    return pdfBuffer;

  } finally {
    // Always clean up temp directory
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

// Simplify LaTeX content for online compilation by removing unsupported packages
function simplifyForOnline(content: string): string {

  // Remove custom fonts and packages that online services don't have
  let simplified = content
    // Remove custom fonts
    .replace(/\\usepackage\{CormorantGaramond.*?\}/g, '% Custom font removed for online compilation')
    .replace(/\\usepackage\{charter\}/g, '% Custom font removed for online compilation')
    // Replace FontAwesome5 with marvosym
    .replace(/\\usepackage\{fontawesome5.*?\}/g, '% FontAwesome5 replaced with marvosym')
    // Remove any existing marvosym to avoid duplicates
    .replace(/\\usepackage\{marvosym\}/g, '')
    // Remove other potentially problematic packages
    .replace(/\\usepackage\{mathpazo\}/g, '% mathpazo removed for online compilation')
    .replace(/\\usepackage\{palatino\}/g, '% palatino removed for online compilation');

  // Add marvosym at the end for symbols support
  simplified += '\n% Marvosym added for online compilation symbol support\n\\usepackage{marvosym}\n';

  return simplified;
}

// Compile using online LaTeX.Online API (fallback)
async function compileOnline(content: string, simplified: boolean = false): Promise<Buffer> {
  const contentToCompile = simplified ? simplifyForOnline(content) : content;

  // Add timeout controller (30 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://latex.aslushnikov.com/compile?target=pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: contentToCompile,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();

      // If not simplified yet and got an error, try with simplified version
      if (!simplified && (errorText.includes('Font') || errorText.includes('package') || errorText.includes('not found') || errorText.includes('CormorantGaramond') || errorText.includes('fontawesome'))) {
        return compileOnline(content, true);
      }

      throw new Error(`Online compilation failed: ${errorText.substring(0, 300)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error('Online compilation produced empty PDF');
    }

    return buffer;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Online compilation timed out after 30 seconds. The LaTeX document may be too complex or the service is slow.');
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { content, filename, useOnline = false } = await request.json();

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'No LaTeX content provided' },
        { status: 400 }
      );
    }

    let pdfBuffer: Buffer;
    let compilationMethod: string;

    // Check if user explicitly requested online compilation
    if (useOnline) {
      try {
        pdfBuffer = await compileOnline(content);
        compilationMethod = 'online';
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Online compilation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
            suggestion: 'Try installing Docker and pulling the texlive/texlive image for better reliability.'
          },
          { status: 500 }
        );
      }
    } else {
      // Try Docker compilation first
      const dockerCheck = await checkDockerInstallation();

      if (dockerCheck.running) {
        // Docker is running, check for texlive image
        const imageCheck = await ensureTexliveImage(TEXLIVE_IMAGE_TAG, false);

        if (imageCheck.available) {
          try {
            pdfBuffer = await compileWithDocker(content);
            compilationMethod = `docker (texlive:${TEXLIVE_IMAGE_TAG})`;
          } catch (error) {
            // If Docker compilation fails, try online as fallback
            const errorString = error instanceof Error ? error.message : 'Docker compilation failed';

            console.error('Docker LaTeX compilation failed, trying online fallback:', errorString);

            try {
              pdfBuffer = await compileOnline(content);
              compilationMethod = 'online (docker failed, fallback successful)';
            } catch (onlineError) {
              const onlineErrorMsg = onlineError instanceof Error ? onlineError.message : 'Unknown error';
              console.error('Both docker and online compilation failed:', { dockerError: errorString, onlineErrorMsg });

              return NextResponse.json(
                {
                  success: false,
                  error: `Compilation failed using both methods`,
                  dockerError: errorString,
                  onlineError: onlineErrorMsg,
                  dockerAvailable: true,
                  suggestion: 'Docker compilation failed, and online fallback also failed. This might be due to invalid LaTeX syntax or unsupported packages. Check the error details below.',
                  attemptedMethods: ['docker', 'online']
                },
                { status: 500 }
              );
            }
          }
        } else {
          // Docker running but image not available
          const imageAvailableMsg = imageCheck.needsPull
            ? `Docker image texlive/texlive:${TEXLIVE_IMAGE_TAG} not found. Pull it with: docker pull texlive/texlive:${TEXLIVE_IMAGE_TAG}`
            : 'Docker image check failed';


          try {
            pdfBuffer = await compileOnline(content);
            compilationMethod = 'online (docker image not available)';
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return NextResponse.json(
              {
                success: false,
                error: `${imageAvailableMsg}. Online compilation also failed: ${errorMessage}`,
                dockerAvailable: true,
                imageAvailable: false,
                pullInstructions: `docker pull texlive/texlive:${TEXLIVE_IMAGE_TAG}`,
                suggestion: 'Pull the Docker image for full LaTeX support, or check your internet connection for online compilation.'
              },
              { status: 503 }
            );
          }
        }
      } else {
        // Docker not installed or not running, try online
        try {
          pdfBuffer = await compileOnline(content);
          compilationMethod = 'online (docker not available)';
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const installInstructions = getDockerInstallInstructions();

          return NextResponse.json(
            {
              success: false,
              error: `Docker is not available and online compilation failed: ${errorMessage}`,
              dockerAvailable: false,
              dockerStatus: dockerCheck.error || 'Docker not running',
              installInstructions,
              suggestion: 'Install Docker and pull the texlive/texlive image for reliable offline compilation with full package support.'
            },
            { status: 503 }
          );
        }
      }
    }

    // Return PDF as base64
    const base64Pdf = pdfBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      pdfUrl: `data:application/pdf;base64,${base64Pdf}`,
      compilationMethod,
      filename: filename || 'document.pdf'
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        suggestion: 'An unexpected error occurred. Check server logs for details.'
      },
      { status: 500 }
    );
  }
}
