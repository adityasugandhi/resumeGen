import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface SyncFile {
  name: string;
  path: string;
  content: string;
  modifiedAt: number;
  size: number;
}

interface SyncCompany {
  name: string;
  files: SyncFile[];
}

export async function GET() {
  try {
    const baseDir = path.join(process.cwd(), 'Job_Applications', 'Companies');

    // Check if directory exists
    try {
      await fs.access(baseDir);
    } catch {
      return NextResponse.json({ companies: [] });
    }

    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const companies: SyncCompany[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Sanitize: only allow alphanumeric, underscore, hyphen, space
      if (!/^[a-zA-Z0-9_\- ]+$/.test(entry.name)) continue;

      const companyDir = path.join(baseDir, entry.name);
      const companyFiles = await fs.readdir(companyDir, { withFileTypes: true });

      const files: SyncFile[] = [];

      for (const file of companyFiles) {
        if (!file.isFile() || !file.name.endsWith('.tex')) continue;

        const filePath = path.join(companyDir, file.name);
        const relativePath = path.join('Job_Applications', 'Companies', entry.name, file.name);

        try {
          const [stat, content] = await Promise.all([
            fs.stat(filePath),
            fs.readFile(filePath, 'utf-8'),
          ]);

          files.push({
            name: file.name,
            path: relativePath,
            content,
            modifiedAt: stat.mtimeMs,
            size: stat.size,
          });
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      if (files.length > 0) {
        // Display name: replace underscores with spaces
        const displayName = entry.name.replace(/_/g, ' ');
        companies.push({ name: displayName, files });
      }
    }

    // Sort companies alphabetically
    companies.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ companies });
  } catch (error) {
    console.error('Resume sync error:', error);
    return NextResponse.json(
      { error: 'Failed to scan resume files' },
      { status: 500 }
    );
  }
}
