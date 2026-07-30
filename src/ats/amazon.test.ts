import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmazon, parseAmazonDate, amazonUrl } from './amazon';
import { normalizeJob } from '../ingest/normalize';
import type { Source } from '../types';

const source: Source = {
  company: 'Amazon',
  ats: 'amazon',
  slug: 'amazon',
  tier: 1,
  tags: ['big-tech'],
  enabled: true,
};

const fixture = {
  hits: 1529,
  jobs: [
    {
      id: '1',
      id_icims: '10488738',
      title: 'Software Development Engineer II, WW Sustainability',
      job_path: '/en/jobs/10488738/software-development-engineer-ii-ww-sustainability',
      location: 'US, WA, Seattle',
      normalized_location: 'Seattle, Washington, USA',
      posted_date: 'July 30, 2026',
      description: '<p>Build distributed systems.</p>',
      basic_qualifications: '<p>Experience with Java and AWS.</p>',
      preferred_qualifications: '<p>Kubernetes a plus.</p>',
    },
  ],
};

test('amazonUrl constrains to US + tech categories', () => {
  const u = amazonUrl(0);
  assert.ok(u.includes('normalized_country_code%5B%5D=USA'));
  assert.ok(u.includes('category%5B%5D=software-development'));
  assert.ok(u.includes('sort=recent'));
});

test('parseAmazon maps jobs + merges qualifications into the description', () => {
  const raw = parseAmazon(fixture, source);
  assert.equal(raw.length, 1);
  const a = raw[0]!;
  assert.equal(a.ats, 'amazon');
  assert.equal(a.atsJobId, '10488738'); // prefers id_icims
  assert.equal(a.applyUrl, 'https://www.amazon.jobs/en/jobs/10488738/software-development-engineer-ii-ww-sustainability');
  assert.deepEqual(a.locations, ['Seattle, Washington, USA']);
  assert.ok(a.description!.includes('distributed systems'));
  assert.ok(a.description!.includes('Java and AWS'));
  assert.ok(a.description!.includes('Kubernetes'));
  assert.ok((a.postedAt ?? '').startsWith('2026-07-30'));
});

test('parseAmazonDate handles Amazon prose dates', () => {
  assert.ok(parseAmazonDate('July 30, 2026')?.startsWith('2026-07-30'));
  assert.equal(parseAmazonDate('not a date'), null);
  assert.equal(parseAmazonDate(null), null);
});

test('normalizeJob works on amazon output (US + tech classified)', () => {
  const job = normalizeJob(parseAmazon(fixture, source)[0]!);
  assert.ok(!/[<>]/.test(job.description), 'HTML stripped');
  assert.equal(job.country, 'US');
  assert.equal(job.category, 'swe-general');
});

test('parseAmazon tolerates empty results', () => {
  assert.deepEqual(parseAmazon({ jobs: [] }, source), []);
  assert.deepEqual(parseAmazon({}, source), []);
});
