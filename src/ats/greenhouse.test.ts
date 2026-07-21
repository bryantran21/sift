import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseGreenhouse } from './greenhouse';
import { normalizeJob } from '../ingest/normalize';
import type { Source } from '../types';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(path.join(here, '__fixtures__', 'greenhouse.sample.json'), 'utf8'),
);

const source: Source = {
  company: 'Anthropic',
  ats: 'greenhouse',
  slug: 'anthropic',
  tier: 1,
  tags: ['ai-research'],
  enabled: true,
};

test('parseGreenhouse maps every job and preserves source metadata', () => {
  const raw = parseGreenhouse(fixture, source);
  assert.equal(raw.length, fixture.jobs.length);

  const first = raw[0]!;
  assert.equal(first.ats, 'greenhouse');
  assert.equal(first.company, 'Anthropic');
  assert.equal(first.companyTier, 1);
  assert.equal(first.sourceSlug, 'anthropic');
  assert.ok(first.atsJobId.length > 0, 'atsJobId should be set');
  assert.ok(first.applyUrl.startsWith('http'), 'applyUrl should be absolute');
  assert.equal(first.descriptionFormat, 'html');
  assert.ok((first.description ?? '').includes('&lt;'), 'raw content is entity-encoded HTML');
});

test('normalizeJob strips HTML/entities and yields plain text', () => {
  const raw = parseGreenhouse(fixture, source);
  const job = normalizeJob(raw[0]!);

  assert.ok(!/[<>]/.test(job.description), 'no angle brackets should survive');
  assert.ok(!job.description.includes('&lt;'), 'entities should be decoded');
  assert.ok(!job.description.includes('&amp;'), 'double-encoded entities should be decoded');
  assert.ok(job.description.length > 100, 'a real JD should have substance');
});

test('normalizeJob produces a deterministic 20-char id', () => {
  const raw = parseGreenhouse(fixture, source);
  const a = normalizeJob(raw[0]!);
  const b = normalizeJob(raw[0]!);
  assert.equal(a.id, b.id, 'id must be stable across runs');
  assert.equal(a.id.length, 20);
  const other = normalizeJob(raw[1]!);
  assert.notEqual(a.id, other.id, 'different postings get different ids');
});

test('parseGreenhouse tolerates an empty board', () => {
  const raw = parseGreenhouse({ jobs: [], meta: { total: 0 } }, source);
  assert.deepEqual(raw, []);
});
