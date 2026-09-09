import { extractText, getDocumentProxy } from 'unpdf';
import { extractSkills } from '../../../scoring/skills';
import { getDeviceId } from '../../../lib/device';
import { getProfile, saveResumeSkills } from '../../../db/profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 5 * 1024 * 1024;

// GET → the device's saved résumé skills.
export async function GET() {
  const deviceId = await getDeviceId();
  if (!deviceId) return Response.json({ skills: [] });
  const p = await getProfile(deviceId);
  return Response.json({ skills: p.resumeSkills });
}

// POST → persist résumé skills. Accepts JSON { skills } (from paste, extracted client-
// side) or a multipart PDF file (parsed here to text → skills). The raw résumé is never
// stored — only the extracted skills.
export async function POST(req: Request) {
  const deviceId = await getDeviceId();
  const ct = req.headers.get('content-type') ?? '';
  let skills: string[];

  if (ct.includes('application/json')) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response('bad json', { status: 400 });
    }
    const s = (body as { skills?: unknown }).skills;
    if (!Array.isArray(s) || s.some((x) => typeof x !== 'string')) {
      return new Response('skills must be a string[]', { status: 400 });
    }
    skills = s as string[];
  } else if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return new Response('file field required', { status: 400 });
    if (file.size > MAX_BYTES) return new Response('file too large (max 5MB)', { status: 413 });
    let text = '';
    try {
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const res = await extractText(pdf, { mergePages: true });
      text = Array.isArray(res.text) ? res.text.join('\n') : res.text;
    } catch {
      return new Response('could not read PDF — try pasting the text instead', { status: 422 });
    }
    skills = extractSkills(text);
  } else {
    return new Response('unsupported content-type', { status: 415 });
  }

  if (deviceId) await saveResumeSkills(deviceId, skills);
  return Response.json({ skills });
}
