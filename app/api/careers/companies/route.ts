import { NextResponse, NextRequest } from 'next/server';
import { getAllCompanies, getCompanyConfig } from '@/lib/careers/company-registry';
import {
  createCompany,
  updateCompany,
  deleteCompany,
} from '@/lib/db/queries/companies';

export async function GET() {
  const companies = await getAllCompanies();
  return NextResponse.json({
    companies: companies.map((c) => ({
      name: c.name,
      platform: c.platform,
      careersUrl: c.careersUrl,
    })),
    totalCount: companies.length,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, platform, boardToken, careersUrl } = body;

  if (!name || !platform || !boardToken || !careersUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const existing = await getCompanyConfig(name);
  if (existing) {
    return NextResponse.json({ error: 'Company already exists' }, { status: 409 });
  }

  const company = await createCompany({ name, platform, boardToken, careersUrl });
  return NextResponse.json({ company }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { name, ...updates } = body;

  if (!name) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  }

  const updated = await updateCompany(name, updates);
  if (!updated) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  return NextResponse.json({ company: updated });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  }

  const deleted = await deleteCompany(name);
  if (!deleted) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
