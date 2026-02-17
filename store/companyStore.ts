import { create } from 'zustand';
import { saveCompany, getAllCompanies, deleteCompany as deleteCompanyFromDB } from '@/lib/indexeddb';
import { generateId } from '@/lib/utils';
import { Company } from '@/types';

// Known company domain mappings for accurate logo fetching
const KNOWN_COMPANY_DOMAINS: Record<string, string> = {
  'sierra ai': 'sierra.ai',
  'delta': 'delta.com',
  'delta airlines': 'delta.com',
  'ge vernova': 'gevernova.com',
  'meta': 'meta.com',
  'google': 'google.com',
  'amazon': 'amazon.com',
  'apple': 'apple.com',
  'microsoft': 'microsoft.com',
  'netflix': 'netflix.com',
  'stripe': 'stripe.com',
  'openai': 'openai.com',
  'anthropic': 'anthropic.com',
  'nvidia': 'nvidia.com',
  'salesforce': 'salesforce.com',
  'linkedin': 'linkedin.com',
  'uber': 'uber.com',
  'airbnb': 'airbnb.com',
  'spotify': 'spotify.com',
  'slack': 'slack.com',
  'dropbox': 'dropbox.com',
  'twitter': 'twitter.com',
  'x': 'x.com',
  'snapchat': 'snapchat.com',
  'snap': 'snap.com',
  'pinterest': 'pinterest.com',
  'reddit': 'reddit.com',
  'discord': 'discord.com',
  'coinbase': 'coinbase.com',
  'robinhood': 'robinhood.com',
  'figma': 'figma.com',
  'notion': 'notion.so',
  'vercel': 'vercel.com',
  'github': 'github.com',
  'gitlab': 'gitlab.com',
  'atlassian': 'atlassian.com',
  'jira': 'atlassian.com',
  'twilio': 'twilio.com',
  'datadog': 'datadoghq.com',
  'snowflake': 'snowflake.com',
  'databricks': 'databricks.com',
  'palantir': 'palantir.com',
  'mongodb': 'mongodb.com',
  'elastic': 'elastic.co',
  'hashicorp': 'hashicorp.com',
  'cloudflare': 'cloudflare.com',
};

// Extract domain from company name
export function extractDomain(companyName: string): string {
  const normalizedName = companyName.toLowerCase().trim();

  // Check known mappings first
  if (KNOWN_COMPANY_DOMAINS[normalizedName]) {
    return KNOWN_COMPANY_DOMAINS[normalizedName];
  }

  // Check if name ends with common TLDs
  const tldPatterns = ['.ai', '.com', '.io', '.co', '.net', '.org', '.so'];
  for (const tld of tldPatterns) {
    if (normalizedName.endsWith(tld)) {
      return normalizedName.replace(/\s+/g, '');
    }
  }

  // Clean company name and append .com
  const cleanedName = normalizedName
    .replace(/\s+(inc|llc|ltd|corp|co|corporation|incorporated)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  return `${cleanedName}.com`;
}

// Get Logo.dev logo URL
export function getCompanyLogoUrl(domain: string): string {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || 'pk_W6_6LXGLQxiCH1SwyzeQGA';
  return `https://img.logo.dev/${domain}?token=${token}`;
}

interface CompanyStore {
  companies: Record<string, Company>;
  isLoading: boolean;
  groupByCompany: boolean;
  expandedCompanies: Set<string>;

  // Actions
  addCompany: (name: string, domain?: string) => Promise<Company>;
  getCompanyByName: (name: string) => Company | undefined;
  getCompanyById: (id: string) => Company | undefined;
  getAllCompaniesArray: () => Company[];
  deleteCompany: (id: string) => Promise<void>;
  setGroupByCompany: (value: boolean) => void;
  toggleCompanyExpanded: (companyId: string) => void;
  initializeFromStorage: () => Promise<void>;
}

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  companies: {},
  isLoading: false,
  groupByCompany: true,
  expandedCompanies: new Set<string>(),

  addCompany: async (name: string, domain?: string) => {
    const existingCompany = get().getCompanyByName(name);
    if (existingCompany) {
      return existingCompany;
    }

    const id = generateId();
    const now = Date.now();
    const companyDomain = domain || extractDomain(name);

    const newCompany: Company = {
      id,
      name,
      domain: companyDomain,
      logoUrl: getCompanyLogoUrl(companyDomain),
      createdAt: now,
    };

    await saveCompany(newCompany);

    set((state) => ({
      companies: { ...state.companies, [id]: newCompany },
      expandedCompanies: new Set([...state.expandedCompanies, id]),
    }));

    return newCompany;
  },

  getCompanyByName: (name: string) => {
    const normalizedName = name.toLowerCase().trim();
    return Object.values(get().companies).find(
      (company) => company.name.toLowerCase().trim() === normalizedName
    );
  },

  getCompanyById: (id: string) => {
    return get().companies[id];
  },

  getAllCompaniesArray: () => {
    return Object.values(get().companies).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  },

  deleteCompany: async (id: string) => {
    await deleteCompanyFromDB(id);
    set((state) => {
      const { [id]: _, ...remaining } = state.companies;
      const expandedCompanies = new Set(state.expandedCompanies);
      expandedCompanies.delete(id);
      return { companies: remaining, expandedCompanies };
    });
  },

  setGroupByCompany: (value: boolean) => {
    set({ groupByCompany: value });
  },

  toggleCompanyExpanded: (companyId: string) => {
    set((state) => {
      const expandedCompanies = new Set(state.expandedCompanies);
      if (expandedCompanies.has(companyId)) {
        expandedCompanies.delete(companyId);
      } else {
        expandedCompanies.add(companyId);
      }
      return { expandedCompanies };
    });
  },

  initializeFromStorage: async () => {
    set({ isLoading: true });
    try {
      const companies = await getAllCompanies();
      const companiesRecord: Record<string, Company> = {};
      const expandedCompanies = new Set<string>();

      companies.forEach((company) => {
        companiesRecord[company.id] = company;
        expandedCompanies.add(company.id);
      });

      set({ companies: companiesRecord, expandedCompanies, isLoading: false });
    } catch (error) {
      console.error('Failed to load companies:', error);
      set({ isLoading: false });
    }
  },
}));

// Helper function to extract company name from filename
export function extractCompanyFromFilename(filename: string): string | null {
  // Remove file extension
  const baseName = filename.replace(/\.[^/.]+$/, '');

  // Common patterns: "CompanyName_Role.tex", "CompanyName-Role.tex", "CompanyName Role.tex"
  const patterns = [
    /^([A-Za-z][A-Za-z0-9\s]+?)(?:_|-|\s)(?:resume|cv|cover|letter|swe|engineer|developer|manager|analyst|designer|role)/i,
    /^([A-Za-z][A-Za-z0-9\s]+?)(?:_|-|\s)[A-Z]/,
  ];

  for (const pattern of patterns) {
    const match = baseName.match(pattern);
    if (match) {
      // Clean up the company name
      const companyName = match[1]
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (companyName.length >= 2) {
        return companyName;
      }
    }
  }

  return null;
}
