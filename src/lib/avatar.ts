// Deterministic letter-avatar fallback for a company with no logo. Pure and
// dependency-free (no node:fs), so it's safe in both server and client components.
export function monogram(company: string): { ch: string; hue: number } {
  const s = company.replace(/[^A-Za-z0-9]/g, '');
  const ch = (s ? s[0] : '?').toUpperCase();
  let hue = 0;
  for (let i = 0; i < company.length; i++) hue = (hue * 31 + company.charCodeAt(i)) % 360;
  return { ch, hue };
}
