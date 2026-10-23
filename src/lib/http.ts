// Thin JSON fetch wrapper shared by all adapters. Adds a realistic User-Agent,
// supports conditional requests (ETag / If-Modified-Since, §2), enforces a timeout,
// and throws a typed error on non-2xx so per-source try/catch can record it.

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

export interface HttpRequest {
  url: string;
  method?: 'GET' | 'POST';
  body?: unknown; // JSON-encoded for POST (Workday)
  etag?: string | null;
  lastModified?: string | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface HttpResult<T> {
  status: number;
  notModified: boolean; // true on 304
  data: T | null; // null on 304
  etag: string | null;
  lastModified: string | null;
}

// Transient failures worth retrying: rate limits and gateway/server hiccups. Two retries
// with exponential backoff (honoring Retry-After, capped) keep one throttled board from
// failing a whole run, without hammering a host that's genuinely down.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function httpJson<T>(req: HttpRequest): Promise<HttpResult<T>> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await httpJsonOnce<T>(req);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : null;
      const retryable = status !== null && RETRYABLE.has(status);
      if (!retryable || attempt >= MAX_RETRIES) throw e;
      const retryAfter = e instanceof HttpError ? e.retryAfterMs : null;
      await sleep(Math.min(retryAfter ?? 1500 * 2 ** attempt, 10_000) + Math.random() * 300);
    }
  }
}

async function httpJsonOnce<T>(req: HttpRequest): Promise<HttpResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 20_000);
  try {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json',
      ...req.headers,
    };
    if (req.etag) headers['If-None-Match'] = req.etag;
    if (req.lastModified) headers['If-Modified-Since'] = req.lastModified;
    if (req.method === 'POST') headers['Content-Type'] = 'application/json';

    const res = await fetch(req.url, {
      method: req.method ?? 'GET',
      headers,
      body: req.method === 'POST' ? JSON.stringify(req.body ?? {}) : undefined,
      signal: controller.signal,
    });

    if (res.status === 304) {
      return {
        status: 304,
        notModified: true,
        data: null,
        etag: req.etag ?? null,
        lastModified: req.lastModified ?? null,
      };
    }
    if (!res.ok) {
      await res.text().catch(() => undefined); // drain body to free the socket
      const ra = Number(res.headers.get('retry-after'));
      throw new HttpError(res.status, req.url, Number.isFinite(ra) && ra > 0 ? ra * 1000 : null);
    }
    return {
      status: res.status,
      notModified: false,
      data: (await res.json()) as T,
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    };
  } finally {
    clearTimeout(timer);
  }
}
