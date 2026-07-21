// Minimal concurrency helpers (no dependency). `mapLimit` runs at most `limit`
// workers at once; `jitter` adds a small random delay to spread requests out and
// stay polite to the ATS APIs (§2: concurrency 8, ~300ms jitter between requests).

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runner(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  }

  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, runner);
  await Promise.all(runners);
  return results;
}

export function jitter(maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs + 1));
  return new Promise((resolve) => setTimeout(resolve, ms));
}
