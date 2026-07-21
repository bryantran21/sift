// Dependency-free HTML -> plain text. ATS payloads vary: some send clean HTML,
// Greenhouse double-encodes entities (the raw string literally contains
// "&lt;div&gt;…"). Strategy: decode entities to reveal tags, turn block-level tags
// into newlines, strip the rest, decode once more to catch entities that were
// themselves encoded, then normalize whitespace.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  trade: '™',
  reg: '®',
  copy: '©',
  deg: '°',
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.charCodeAt(0) === 35 /* '#' */) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    const named = NAMED_ENTITIES[body];
    return named ?? match;
  });
}

// Tags whose boundaries imply a line break in the text version.
const BLOCK_TAG =
  /<\/?(p|div|br|li|ul|ol|tr|td|h[1-6]|section|article|header|footer|nav|table|thead|tbody|blockquote|pre)\b[^>]*>/gi;

export function htmlToText(input: string | null | undefined): string {
  if (!input) return '';
  let text = decodeEntities(input);
  text = text.replace(BLOCK_TAG, '\n');
  text = text.replace(/<[^>]+>/g, ''); // strip remaining inline tags
  text = decodeEntities(text); // second pass for originally double-encoded entities
  text = text.replace(/\r/g, '');
  text = text.replace(/[ \t\f\v]+/g, ' ');
  text = text.replace(/ *\n */g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}
