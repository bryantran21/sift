import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhenom, phenomBody } from './phenom';
import type { Source } from '../types';

const source: Source = {
  company: 'Adobe',
  ats: 'phenom',
  slug: 'adobus',
  tier: 3,
  tags: [],
  enabled: true,
  host: 'careers.adobe.com',
  site: 'ADOBUS',
};

test('phenomBody targets refineSearch with the site refNum and US filter', () => {
  const b = phenomBody(source, 'software', 50, 50, 'United States of America');
  assert.equal(b.ddoKey, 'refineSearch');
  assert.equal(b.refNum, 'ADOBUS');
  assert.equal(b.keywords, 'software');
  assert.equal(b.from, 50);
  assert.deepEqual(b.selected_fields, { country: ['United States of America'] });
  assert.deepEqual(phenomBody(source, '', 0, 1, null).selected_fields, {});
});

const jobs = [
  {
    jobId: 'R164904',
    reqId: 'R164904',
    title: 'Software Development Engineer',
    cityStateCountry: 'San Jose, California, United States of America',
    country: 'United States of America',
    postedDate: '2026-09-18T00:00:00.000+0000',
    applyUrl: 'https://adobe.wd5.myworkdayjobs.com/external_experienced/job/San-Jose/SDE_R164904/apply',
  },
  { jobId: 'R2', title: 'Software Engineer', location: 'Bengaluru, India', country: 'India' },
];

test('parsePhenom maps a real job and keeps US jobs when not facet-filtered', () => {
  const out = parsePhenom(jobs, source);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.atsJobId, 'R164904');
  assert.deepEqual(out[0]!.locations, ['San Jose, California, United States of America']);
  assert.equal(out[0]!.postedAt, '2026-09-18T00:00:00.000Z');
  assert.ok(out[0]!.applyUrl.includes('myworkdayjobs.com'));
});

test('parsePhenom trusts the US country selection', () => {
  const out = parsePhenom(jobs, source, true);
  assert.equal(out.length, 2);
  assert.equal(out[1]!.country, 'US');
});
