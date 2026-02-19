/**
 * HTTP Client Adapter for Remote LanceDB Server (FullLanceDB v2.0)
 *
 * Provides the same chainable interface as embedded @lancedb/lancedb
 * but communicates with the FullLanceDB REST API server.
 *
 * Server API contract (from OpenAPI spec):
 *   POST /tables               — create table (body: {table_name, data?})
 *   GET  /tables               — list tables (returns {tables: [{name, row_count, schema}]})
 *   GET  /tables/{name}        — table info
 *   DELETE /tables/{name}      — drop table
 *   GET  /tables/{name}/count  — row count
 *   POST /tables/{name}/add    — add docs (body: {table_name, data})
 *   POST /tables/{name}/search — vector search (body: {table_name, vector, limit?, where?})
 *   POST /tables/{name}/query  — filter query (body: {table_name, limit?, where?})
 *   DELETE /tables/{name}/delete — delete by filter (body: {table_name, where})
 */

interface HttpOptions {
  retries?: number;
  retryDelay?: number;
}

const DEFAULT_OPTIONS: HttpOptions = {
  retries: 1,
  retryDelay: 1000,
};

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  httpOptions: HttpOptions = DEFAULT_OPTIONS
): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...options.headers,
  };

  const fetchOptions: RequestInit = { ...options, headers };
  let lastError: Error | null = null;
  const maxAttempts = (httpOptions.retries ?? 0) + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts && isNetworkError(error)) {
        await sleep(httpOptions.retryDelay ?? 1000);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Request failed after retries');
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('fetch failed') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('NetworkError')
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export class RemoteLanceConnection {
  constructor(private serverUrl: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
  }

  async tableNames(): Promise<string[]> {
    const response = await fetchWithRetry(`${this.serverUrl}/tables`);
    const data = await response.json();
    // Server returns {tables: [{name, row_count, schema}, ...]}
    const tables = data.tables || [];
    return tables.map((t: { name: string } | string) =>
      typeof t === 'string' ? t : t.name
    );
  }

  async openTable(name: string): Promise<RemoteLanceTable> {
    const tables = await this.tableNames();
    if (!tables.includes(name)) {
      throw new Error(`Table '${name}' does not exist`);
    }
    return new RemoteLanceTable(this.serverUrl, name);
  }

  async createTable(
    name: string,
    data: Record<string, unknown>[]
  ): Promise<RemoteLanceTable> {
    // Server: POST /tables with {table_name, data} in body
    await fetchWithRetry(`${this.serverUrl}/tables`, {
      method: 'POST',
      body: JSON.stringify({ table_name: name, data }),
    });
    return new RemoteLanceTable(this.serverUrl, name);
  }

  async dropTable(name: string): Promise<void> {
    await fetchWithRetry(
      `${this.serverUrl}/tables/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    );
  }
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export class RemoteLanceTable {
  constructor(
    private serverUrl: string,
    private tableName: string
  ) {}

  private url(suffix: string = ''): string {
    return `${this.serverUrl}/tables/${encodeURIComponent(this.tableName)}${suffix}`;
  }

  async add(data: Record<string, unknown>[]): Promise<void> {
    await fetchWithRetry(this.url('/add'), {
      method: 'POST',
      body: JSON.stringify({ table_name: this.tableName, data }),
    });
  }

  async delete(filter: string): Promise<void> {
    await fetchWithRetry(this.url('/delete'), {
      method: 'DELETE',
      body: JSON.stringify({ table_name: this.tableName, where: filter }),
    });
  }

  async countRows(): Promise<number> {
    const response = await fetchWithRetry(this.url('/count'));
    const data = await response.json();
    return data.count ?? data.row_count ?? 0;
  }

  query(): RemoteQuery {
    return new RemoteQuery(this.serverUrl, this.tableName);
  }

  vectorSearch(vector: number[]): RemoteVectorSearch {
    return new RemoteVectorSearch(this.serverUrl, this.tableName, vector);
  }
}

// ---------------------------------------------------------------------------
// Query Builder (chainable)
// ---------------------------------------------------------------------------

export class RemoteQuery {
  private filterClause?: string;
  private limitValue?: number;

  constructor(
    private serverUrl: string,
    private tableName: string
  ) {}

  where(filter: string): RemoteQuery {
    this.filterClause = filter;
    return this;
  }

  limit(n: number): RemoteQuery {
    this.limitValue = n;
    return this;
  }

  async toArray(): Promise<Record<string, unknown>[]> {
    const body: Record<string, unknown> = { table_name: this.tableName };
    if (this.filterClause) body.where = this.filterClause;
    if (this.limitValue !== undefined) body.limit = this.limitValue;

    const response = await fetchWithRetry(
      `${this.serverUrl}/tables/${encodeURIComponent(this.tableName)}/query`,
      { method: 'POST', body: JSON.stringify(body) }
    );

    const data = await response.json();
    return data.results || data.data || [];
  }
}

// ---------------------------------------------------------------------------
// Vector Search Builder (chainable)
// ---------------------------------------------------------------------------

export class RemoteVectorSearch {
  private distanceTypeValue: string = 'cosine';
  private limitValue: number = 10;
  private filterClause?: string;

  constructor(
    private serverUrl: string,
    private tableName: string,
    private vector: number[]
  ) {}

  distanceType(type: string): RemoteVectorSearch {
    this.distanceTypeValue = type;
    return this;
  }

  limit(n: number): RemoteVectorSearch {
    this.limitValue = n;
    return this;
  }

  where(filter: string): RemoteVectorSearch {
    this.filterClause = filter;
    return this;
  }

  async toArray(): Promise<Record<string, unknown>[]> {
    const body: Record<string, unknown> = {
      table_name: this.tableName,
      vector: this.vector,
      limit: this.limitValue,
    };
    if (this.filterClause) body.where = this.filterClause;

    const response = await fetchWithRetry(
      `${this.serverUrl}/tables/${encodeURIComponent(this.tableName)}/search`,
      { method: 'POST', body: JSON.stringify(body) }
    );

    const data = await response.json();
    return data.results || data.data || [];
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function connectRemote(serverUrl: string): Promise<RemoteLanceConnection> {
  const connection = new RemoteLanceConnection(serverUrl);
  try {
    await connection.tableNames();
  } catch (error) {
    throw new Error(`Failed to connect to LanceDB server at ${serverUrl}: ${error}`);
  }
  return connection;
}

export type {
  RemoteLanceConnection,
  RemoteLanceTable,
  RemoteQuery,
  RemoteVectorSearch,
};
