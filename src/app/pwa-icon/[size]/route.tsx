import { ImageResponse } from 'next/og';

// PNG app icons for launchers that don't take the SVG manifest icons (older Android).
//   /pwa-icon/192 · /pwa-icon/512           → rounded tile ("any")
//   /pwa-icon/maskable-192 · maskable-512    → full-bleed tile, mark inside the safe zone
export const dynamic = 'force-static';

const SIZES: Record<string, { px: number; maskable: boolean }> = {
  '192': { px: 192, maskable: false },
  '512': { px: 512, maskable: false },
  'maskable-192': { px: 192, maskable: true },
  'maskable-512': { px: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const spec = SIZES[(await params).size];
  if (!spec) return new Response('Not found', { status: 404 });
  const { px, maskable } = spec;
  // The funnel mark from icon.svg (64-unit viewBox), scaled into the tile.
  const mark = maskable ? px * 0.56 : px * 0.72;
  return new ImageResponse(
    (
      <div
        style={{
          width: px,
          height: px,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2f6df6',
          borderRadius: maskable ? 0 : px * 0.22,
        }}
      >
        <svg width={mark} height={mark} viewBox="12 16 40 37">
          <path d="M14 18h36l-12 15v13l-12 5V33L14 18z" fill="#ffffff" fillOpacity={0.96} />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
