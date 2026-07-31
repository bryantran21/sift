import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNetflix, netflixUrl } from './netflix';
import { normalizeJob } from '../ingest/normalize';
import type { Source } from '../types';

const source: Source = {
  company: 'Netflix',
  ats: 'netflix',
  slug: 'netflix',
  tier: 2,
  tags: ['big-tech'],
  enabled: true,
};

const fixture = {
  count: 67,
  positions: [
    {
      id: 790317562896,
      ats_job_id: 'JR-abc',
      display_job_id: 'JR-abc',
      name: 'Software Engineer 5 - Ads Forecasting',
      location: 'New York,New York,United States of America',
      locations: [
        'New York,New York,United States of America',
        'Los Gatos,California,United States of America',
      ],
      t_update: 1785196800,
      canonicalPositionUrl: 'https://explore.jobs.netflix.net/careers/job/790317562896',
      job_description: '',
    },
  ],
};

test('netflixUrl constrains to US + paginates', () => {
  const u = netflixUrl(100);
  assert.ok(u.includes('domain=netflix.com'));
  assert.ok(u.includes('start=100'));
  assert.ok(u.includes('location=United+States'));
});

test('parseNetflix maps Eightfold positions + tidies locations', () => {
  const raw = parseNetflix(fixture, source);
  assert.equal(raw.length, 1);
  const a = raw[0]!;
  assert.equal(a.ats, 'netflix');
  assert.equal(a.atsJobId, 'JR-abc');
  assert.equal(a.title, 'Software Engineer 5 - Ads Forecasting');
  assert.deepEqual(a.locations, [
    'New York, New York, United States of America',
    'Los Gatos, California, United States of America',
  ]);
  assert.equal(a.applyUrl, 'https://explore.jobs.netflix.net/careers/job/790317562896');
  assert.ok((a.postedAt ?? '').startsWith('20'), 't_update epoch → ISO');
});

test('normalizeJob classifies Netflix output as US + swe-general', () => {
  const job = normalizeJob(parseNetflix(fixture, source)[0]!);
  assert.equal(job.country, 'US');
  assert.equal(job.category, 'swe-general');
});

test('parseNetflix tolerates empty results', () => {
  assert.deepEqual(parseNetflix({ positions: [] }, source), []);
  assert.deepEqual(parseNetflix({}, source), []);
});
