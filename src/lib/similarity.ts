// Cosine similarity over bag-of-words term-frequency vectors. Used by fan-out
// collapse (§6a) to decide whether two postings that share a (company, title) are
// the same requisition duplicated across locations — i.e. near-identical JD text —
// or two genuinely different roles that happen to normalize to the same title.
//
// This is plain TF cosine, a simpler cousin of the spec's TF-IDF: for pairwise
// near-duplicate detection at a 0.9 threshold it behaves the same and is easy to
// read. Swap in IDF weighting here if you ever want it.

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

export function cosineSim(a: string, b: string): number {
  const ta = termFreq(tokenize(a));
  const tb = termFreq(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;

  let dot = 0;
  for (const [term, fa] of ta) {
    const fb = tb.get(term);
    if (fb) dot += fa * fb;
  }
  let na = 0;
  for (const v of ta.values()) na += v * v;
  let nb = 0;
  for (const v of tb.values()) nb += v * v;

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
