import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);

const LATEX_PATHS = [
  '/usr/local/texlive/2024/bin/universal-darwin',
  '/usr/local/texlive/2025/bin/universal-darwin',
  '/Library/TeX/texbin',
  '/usr/local/bin',
  '/opt/homebrew/bin',
  '/usr/bin',
  '/usr/texbin',
];

export const runtime = 'nodejs';

export async function GET() {
  const augmentedPath = `${LATEX_PATHS.join(':')}:${process.env.PATH}`;

  const checks = {
    system: process.platform,
    timestamp: new Date().toISOString(),
    latex: {
      installed: false,
      path: null as string | null,
      version: null as string | null,
    },
    paths: {
      current: process.env.PATH,
      augmented: augmentedPath,
      searchedLocations: LATEX_PATHS,
    },
    packages: {} as Record<string, boolean>,
  };

  // Check for pdflatex
  try {
    const { stdout: whichOutput } = await execAsync('which pdflatex', {
      env: { ...process.env, PATH: augmentedPath }
    });
    checks.latex.path = whichOutput.trim();
    checks.latex.installed = true;

    // Get version
    try {
      const { stdout: versionOutput } = await execAsync('pdflatex --version', {
        env: { ...process.env, PATH: augmentedPath }
      });
      checks.latex.version = versionOutput.split('\n')[0];
    } catch {
      checks.latex.version = 'Unable to determine version';
    }

    // Check for required packages
    const packagesToCheck = [
      'xcolor',
      'enumitem',
      'titlesec',
      'hyperref',
      'fontawesome5',
      'geometry',
    ];

    for (const pkg of packagesToCheck) {
      try {
        await execAsync(`kpsewhich ${pkg}.sty`, {
          env: { ...process.env, PATH: augmentedPath }
        });
        checks.packages[pkg] = true;
      } catch {
        checks.packages[pkg] = false;
      }
    }
  } catch {
    checks.latex.installed = false;
  }

  return NextResponse.json({
    status: checks.latex.installed ? 'ready' : 'not-installed',
    checks,
    recommendations: getRecommendations(checks),
  });
}

interface LatexChecks {
  system: string;
  timestamp: string;
  latex: {
    installed: boolean;
    path: string | null;
    version: string | null;
  };
  paths: {
    current: string | undefined;
    augmented: string;
    searchedLocations: string[];
  };
  packages: Record<string, boolean>;
}

function getRecommendations(checks: LatexChecks): string[] {
  const recommendations: string[] = [];

  if (!checks.latex.installed) {
    if (checks.system === 'darwin') {
      recommendations.push('Install BasicTeX: brew install --cask basictex');
      recommendations.push('Then run: eval "$(/usr/libexec/path_helper)"');
      recommendations.push('Install packages: sudo tlmgr install collection-fontsrecommended');
    } else if (checks.system === 'linux') {
      recommendations.push('Install TeX Live: sudo apt-get install texlive-full');
    } else if (checks.system === 'win32') {
      recommendations.push('Download and install MiKTeX from https://miktex.org/download');
    }
  } else {
    // Check for missing packages
    const missingPackages = Object.entries(checks.packages)
      .filter(([_, installed]) => !installed)
      .map(([pkg]) => pkg);

    if (missingPackages.length > 0) {
      recommendations.push(`Install missing packages: sudo tlmgr install ${missingPackages.join(' ')}`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('LaTeX is properly configured!');
  }

  return recommendations;
}
