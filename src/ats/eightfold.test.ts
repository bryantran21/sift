import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePcsx, parseV2, pcsxUrl } from './eightfold';
import type { Source } from '../types';

const source: Source = {
  company: 'Starbucks',
  ats: 'eightfold',
  slug: 'starbucks',
  tier: 3,
  tags: [],
  enabled: true,
  host: 'starbucks.eightfold.ai',
  site: 'starbucks.com',
};

test('pcsxUrl is US-constrained and carries the domain + query', () => {
  const u = new URL(pcsxUrl(source, 'software', 20));
  assert.equal(u.host, 'starbucks.eightfold.ai');
  assert.equal(u.pathname, '/api/pcsx/search');
  assert.equal(u.searchParams.get('domain'), 'starbucks.com');
  assert.equal(u.searchParams.get('query'), 'software');
  assert.equal(u.searchParams.get('location'), 'United States');
  assert.equal(u.searchParams.get('start'), '20');
});

test('parsePcsx maps a real position', () => {
  const [j] = parsePcsx(
    [
      {
        id: 481078371803,
        displayJobId: '260034646',
        name: 'software engineer- ST, Seattle, WA',
        locations: ['Seattle, Washington, United States'],
        postedTs: 1791919007,
        positionUrl: '/careers/job/481078371803',
        workLocationOption: 'onsite',
      },
    ],
    source,
  );
  assert.equal(j!.atsJobId, '260034646');
  assert.equal(j!.applyUrl, 'https://starbucks.eightfold.ai/careers/job/481078371803');
  assert.equal(j!.country, 'US');
  assert.equal(j!.workplaceType, 'onsite');
  assert.deepEqual(j!.locations, ['Seattle, Washington, United States']);
  assert.ok(j!.postedAt?.startsWith('2026'));
});

test('parseV2 maps the legacy shape', () => {
  const [j] = parseV2([{ id: 7, display_job_id: 'R1', name: 'Data Scientist', locations: ['Austin,Texas,USA'], t_create: 1791919007 }], source);
  assert.equal(j!.atsJobId, 'R1');
  assert.deepEqual(j!.locations, ['Austin, Texas, USA']);
  assert.equal(j!.applyUrl, 'https://starbucks.eightfold.ai/careers/job/7');
});
