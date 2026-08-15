import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSmartRecruiters, smartRecruitersUrl } from './smartrecruiters';
import { normalizeJob } from '../ingest/normalize';
import type { Source } from '../types';

const source: Source = {
  company: 'Western Digital',
  ats: 'smartrecruiters',
  slug: 'WesternDigital',
  tier: 3,
  tags: ['fortune-500'],
  enabled: true,
};

const fixture = {
  totalFound: 70,
  content: [
    {
      id: '744000143588524',
      name: 'Software Development Engineer',
      refNumber: 'REF32451P',
      releasedDate: '2026-08-14T19:00:38.580Z',
      location: {
        city: 'Roseville',
        region: 'CA',
        country: 'us',
        remote: false,
        hybrid: false,
        fullLocation: 'Roseville, CA, United States',
      },
    },
    {
      id: '744000143588999',
      name: 'Remote Backend Engineer',
      location: { city: 'Austin', region: 'TX', country: 'us', remote: true, fullLocation: 'Austin, TX, United States' },
    },
  ],
};

test('smartRecruitersUrl constrains to US + paginates', () => {
  const u = smartRecruitersUrl('WesternDigital', 100);
  assert.ok(u.includes('/companies/WesternDigital/postings'));
  assert.ok(u.includes('country=us'));
  assert.ok(u.includes('offset=100'));
});

test('parseSmartRecruiters maps postings + location', () => {
  const raw = parseSmartRecruiters(fixture, source);
  assert.equal(raw.length, 2);
  const a = raw[0]!;
  assert.equal(a.ats, 'smartrecruiters');
  assert.equal(a.atsJobId, '744000143588524');
  assert.equal(a.reqNumber, 'REF32451P');
  assert.deepEqual(a.locations, ['Roseville, CA, United States']);
  assert.equal(a.applyUrl, 'https://jobs.smartrecruiters.com/WesternDigital/744000143588524');
  assert.equal(a.postedAt, '2026-08-14T19:00:38.580Z');
  assert.equal(raw[1]!.workplaceType, 'remote');
});

test('normalizeJob classifies SmartRecruiters output as US + tech', () => {
  const job = normalizeJob(parseSmartRecruiters(fixture, source)[0]!);
  assert.equal(job.country, 'US');
  assert.equal(job.category, 'swe-general');
});

test('parseSmartRecruiters tolerates empty results', () => {
  assert.deepEqual(parseSmartRecruiters({ content: [] }, source), []);
  assert.deepEqual(parseSmartRecruiters({}, source), []);
});
