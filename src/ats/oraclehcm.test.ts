import test from 'node:test';
import assert from 'node:assert/strict';
import { oracleUrl, parseOracle } from './oraclehcm';
import type { Source } from '../types';

const source: Source = {
  company: 'JPMorgan Chase',
  ats: 'oraclehcm',
  slug: 'jpmc',
  tier: 2,
  tags: [],
  enabled: true,
  host: 'jpmc.fa.oraclecloud.com',
  site: 'CX_1001',
};

test('oracleUrl builds the finder with keyword + US facet', () => {
  const u = oracleUrl(source, 50, 'software engineer', 300000000289738);
  assert.ok(u.startsWith('https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?'));
  assert.ok(u.includes('finder=findReqs;siteNumber=CX_1001,limit=25,offset=50'));
  assert.ok(u.includes('keyword=%22software%20engineer%22'));
  assert.ok(u.includes('selectedLocationsFacet=300000000289738'));
});

const reqs = [
  { Id: '1', Title: 'Lead Software Engineer', PostedDate: '2026-10-23', PrimaryLocation: 'San Francisco, CA, United States', PrimaryLocationCountry: 'US', ShortDescriptionStr: 'full-stack lead' },
  { Id: '2', Title: 'AIML Developer', PostedDate: '2026-10-23', PrimaryLocation: 'GLASGOW, United Kingdom', PrimaryLocationCountry: 'GB' },
  { Id: '3', Title: 'Data Engineer', PrimaryLocation: 'London, United Kingdom', PrimaryLocationCountry: 'GB', secondaryLocations: [{ Name: 'New York, NY, United States', CountryCode: 'US' }] },
];

test('parseOracle keeps US postings (primary or secondary) when not facet-filtered', () => {
  const jobs = parseOracle(reqs, source);
  assert.deepEqual(jobs.map((j) => j.atsJobId), ['1', '3']);
  assert.equal(jobs[0]!.applyUrl, 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/1');
  assert.deepEqual(jobs[1]!.locations, ['London, United Kingdom', 'New York, NY, United States']);
  assert.equal(jobs[0]!.postedAt, '2026-10-23T00:00:00.000Z');
});

test('parseOracle trusts the US facet', () => {
  assert.equal(parseOracle(reqs, source, true).length, 3);
});
