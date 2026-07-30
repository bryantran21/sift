import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAshby, ashbyUrl } from './ashby';
import { normalizeJob } from '../ingest/normalize';
import type { Source } from '../types';

const source: Source = {
  company: 'OpenAI',
  ats: 'ashby',
  slug: 'openai',
  tier: 1,
  tags: ['big-tech'],
  enabled: true,
};

const fixture = {
  jobs: [
    {
      id: 'abc-123',
      title: 'Software Engineer, Backend',
      location: 'San Francisco',
      secondaryLocations: [{ location: 'Remote - US' }],
      isRemote: false,
      descriptionHtml: '<p>Build with Python and Kubernetes.</p>',
      publishedAt: '2026-07-01T00:00:00Z',
      jobUrl: 'https://jobs.ashbyhq.com/openai/abc-123',
    },
    {
      id: 'def-456',
      title: 'Research Engineer',
      location: 'Remote',
      isRemote: true,
      descriptionHtml: '<p>PyTorch.</p>',
      applyUrl: 'https://jobs.ashbyhq.com/openai/def-456/application',
    },
  ],
};

test('ashbyUrl builds the posting-api endpoint', () => {
  assert.equal(
    ashbyUrl('openai'),
    'https://api.ashbyhq.com/posting-api/job-board/openai?includeCompensation=false',
  );
});

test('parseAshby maps postings + source metadata + secondary locations', () => {
  const raw = parseAshby(fixture, source);
  assert.equal(raw.length, 2);
  const a = raw[0]!;
  assert.equal(a.ats, 'ashby');
  assert.equal(a.company, 'OpenAI');
  assert.equal(a.companyTier, 1);
  assert.equal(a.atsJobId, 'abc-123');
  assert.deepEqual(a.locations, ['San Francisco', 'Remote - US']);
  assert.equal(a.descriptionFormat, 'html');
  assert.ok(a.applyUrl.startsWith('http'));
  assert.equal(raw[1]!.workplaceType, 'remote'); // isRemote → remote
});

test('parseAshby falls back to a constructed posting URL', () => {
  const raw = parseAshby({ jobs: [{ id: 'x1', title: 'Eng' }] }, source);
  assert.equal(raw[0]!.applyUrl, 'https://jobs.ashbyhq.com/openai/x1');
});

test('normalizeJob works on ashby output', () => {
  const job = normalizeJob(parseAshby(fixture, source)[0]!);
  assert.ok(!/[<>]/.test(job.description), 'HTML stripped');
  assert.equal(job.id.length, 20);
});

test('parseAshby tolerates an empty/missing board', () => {
  assert.deepEqual(parseAshby({ jobs: [] }, source), []);
  assert.deepEqual(parseAshby({}, source), []);
});
