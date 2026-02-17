export interface H1bExportParams {
  jobTitle?: string;
  company?: string;
  year?: string[];
  city?: string;
  state?: string;
  metroArea?: string;
}

const EXPORT_BASE_URL = "https://online.goinglobal.com/h1b/export";

export async function fetchH1bCsv(
  cookies: string,
  params: H1bExportParams
): Promise<string> {
  const url = new URL(EXPORT_BASE_URL);

  if (params.jobTitle) url.searchParams.set("jobTitle", params.jobTitle);
  if (params.company) url.searchParams.set("company", params.company);
  if (params.city) url.searchParams.set("city", params.city);
  if (params.state) url.searchParams.set("state", params.state);
  if (params.metroArea) url.searchParams.set("metroArea", params.metroArea);

  if (params.year && params.year.length > 0) {
    params.year.forEach((y, i) => {
      url.searchParams.set(`year[${i}]`, y);
    });
  }

  url.searchParams.set("attach", "h1b_page");

  const response = await fetch(url.toString(), {
    headers: { Cookie: cookies },
  });

  if (!response.ok) {
    throw new Error(
      `GoingGlobal export failed: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}
