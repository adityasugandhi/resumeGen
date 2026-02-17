import { getSessionCookies } from "./cookies";
import { fetchH1bCsv, type H1bExportParams } from "./export";

export interface H1bRecord {
  jobTitle: string;
  occupation: string;
  company: string;
  cityState: string;
  metro: string;
  wage: string;
  year: string;
}

export interface SalaryInsight {
  company: string;
  role: string;
  avgWage: number;
  minWage: number;
  maxWage: number;
  locations: string[];
  count: number;
}

export interface CompanyH1bProfile {
  company: string;
  totalPositions: number;
  roles: { title: string; wage: number; location: string }[];
  avgWage: number;
  topMetros: { metro: string; count: number }[];
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvToRecords(csv: string): H1bRecord[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      jobTitle: cols[0] || "",
      occupation: cols[1] || "",
      company: cols[2] || "",
      cityState: cols[3] || "",
      metro: cols[4] || "",
      wage: cols[5] || "",
      year: cols[6] || "",
    };
  });
}

function parseWage(wage: string): number {
  return parseInt(wage.replace(/[$,]/g, ""), 10) || 0;
}

export async function getCompanyH1bProfile(
  company: string,
  years: string[] = ["2025", "2026"]
): Promise<CompanyH1bProfile> {
  const cookies = await getSessionCookies();
  const csv = await fetchH1bCsv(cookies, { company, year: years });
  const records = parseCsvToRecords(csv);

  const wages = records.map((r) => parseWage(r.wage)).filter((w) => w > 0);
  const avgWage =
    wages.length > 0
      ? Math.round(wages.reduce((a, b) => a + b, 0) / wages.length)
      : 0;

  // Count by metro
  const metroCounts = new Map<string, number>();
  for (const r of records) {
    metroCounts.set(r.metro, (metroCounts.get(r.metro) || 0) + 1);
  }
  const topMetros = [...metroCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([metro, count]) => ({ metro, count }));

  return {
    company,
    totalPositions: records.length,
    roles: records.map((r) => ({
      title: r.jobTitle,
      wage: parseWage(r.wage),
      location: r.cityState,
    })),
    avgWage,
    topMetros,
  };
}

export async function getSalaryBenchmark(
  jobTitle: string,
  years: string[] = ["2025", "2026"]
): Promise<SalaryInsight[]> {
  const cookies = await getSessionCookies();
  const csv = await fetchH1bCsv(cookies, { jobTitle, year: years });
  const records = parseCsvToRecords(csv);

  // Group by company
  const grouped = new Map<string, H1bRecord[]>();
  for (const r of records) {
    const key = r.company;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  return [...grouped.entries()]
    .map(([company, recs]) => {
      const wages = recs.map((r) => parseWage(r.wage)).filter((w) => w > 0);
      if (wages.length === 0) return null;
      return {
        company,
        role: jobTitle,
        avgWage: Math.round(wages.reduce((a, b) => a + b, 0) / wages.length),
        minWage: Math.min(...wages),
        maxWage: Math.max(...wages),
        locations: [...new Set(recs.map((r) => r.cityState))],
        count: recs.length,
      };
    })
    .filter((x): x is SalaryInsight => x !== null)
    .sort((a, b) => b.avgWage - a.avgWage);
}

export async function getMarketIntelligence(
  jobTitle: string,
  metro?: string,
  years: string[] = ["2025", "2026"]
): Promise<{
  totalPositions: number;
  avgWage: number;
  medianWage: number;
  topCompanies: { company: string; count: number; avgWage: number }[];
  wageRange: { min: number; max: number };
}> {
  const cookies = await getSessionCookies();
  const params: H1bExportParams = { jobTitle, year: years };
  if (metro) params.metroArea = metro;

  const csv = await fetchH1bCsv(cookies, params);
  const records = parseCsvToRecords(csv);

  const wages = records.map((r) => parseWage(r.wage)).filter((w) => w > 0);
  wages.sort((a, b) => a - b);

  const median =
    wages.length > 0
      ? wages.length % 2 === 0
        ? (wages[wages.length / 2 - 1] + wages[wages.length / 2]) / 2
        : wages[Math.floor(wages.length / 2)]
      : 0;

  // Top companies by count
  const companyCounts = new Map<string, { count: number; totalWage: number }>();
  for (const r of records) {
    const entry = companyCounts.get(r.company) || { count: 0, totalWage: 0 };
    entry.count++;
    entry.totalWage += parseWage(r.wage);
    companyCounts.set(r.company, entry);
  }

  const topCompanies = [...companyCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([company, data]) => ({
      company,
      count: data.count,
      avgWage: Math.round(data.totalWage / data.count),
    }));

  return {
    totalPositions: records.length,
    avgWage:
      wages.length > 0
        ? Math.round(wages.reduce((a, b) => a + b, 0) / wages.length)
        : 0,
    medianWage: median,
    topCompanies,
    wageRange: {
      min: wages.length > 0 ? wages[0] : 0,
      max: wages.length > 0 ? wages[wages.length - 1] : 0,
    },
  };
}
