import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseWorkday, parsePostedOn, cxsUrl } from './workday';
import { normalizeJob } from '../ingest/normalize';
import type { Source } from '../types';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(path.join(here, '__fixtures__', 'workday.sample.json'), 'utf8'));

const source: Source = {
  company: 'Target',
  ats: 'workday',
  slug: 'target',
  tier: 3,
  tags: ['fortune-500'],
  enabled: true,
  tenant: 'target',
  shard: '5',
  site: 'targetcareers',
};

test('cxsUrl builds the tenant/shard/site POST endpoint', () => {
  assert.equal(
    cxsUrl(source),
    'https://target.wd5.myworkdayjobs.com/wday/cxs/target/targetcareers/jobs',
  );
});

test('parseWorkday maps postings and builds absolute apply URLs', () => {
  const raw = parseWorkday(fixture.jobPostings, source);
  assert.ok(raw.length > 0);
  const first = raw[0]!;
  assert.equal(first.ats, 'workday');
  assert.equal(first.company, 'Target');
  assert.ok(first.atsJobId.length > 0, 'reqId from bulletFields');
  assert.ok(
    first.applyUrl.startsWith('https://target.wd5.myworkdayjobs.com/targetcareers/job/'),
    `apply URL should be absolute, got ${first.applyUrl}`,
  );
  assert.equal(first.description, null, 'list endpoint carries no JD');
});

test('parseWorkday skips postings with no externalPath', () => {
  const raw = parseWorkday([{ title: 'Ghost', bulletFields: ['X1'] }], source);
  assert.deepEqual(raw, []);
});

test('parsePostedOn approximates Workday prose to a date', () => {
  assert.ok(parsePostedOn('Posted Today'));
  assert.ok(parsePostedOn('Posted Yesterday'));
  const threeDays = parsePostedOn('Posted 3 Days Ago');
  assert.ok(threeDays && new Date(threeDays) < new Date(), '3 days ago is in the past');
  const thirtyPlus = parsePostedOn('Posted 30+ Days Ago');
  assert.ok(thirtyPlus, '30+ days ago parses');
  const ageDays = (Date.now() - new Date(thirtyPlus!).getTime()) / 86_400_000;
  assert.ok(ageDays >= 29 && ageDays <= 31, `~30 days old, got ${ageDays.toFixed(1)}`);
  assert.equal(parsePostedOn('Reviewed weekly'), null);
  assert.equal(parsePostedOn(null), null);
});

test('normalizeJob handles a description-less Workday posting', () => {
  const [raw] = parseWorkday(fixture.jobPostings, source);
  const job = normalizeJob(raw!);
  assert.equal(job.ats, 'workday');
  assert.equal(job.description, '');
  assert.equal(job.id.length, 20);
});
