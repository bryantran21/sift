import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLever, leverUrl } from './lever';
import { normalizeJob } from '../ingest/normalize';
import type { Source } from '../types';

const source: Source = {
  company: 'Netflix',
  ats: 'lever',
  slug: 'netflix',
  tier: 2,
  tags: ['big-tech'],
  enabled: true,
};

const fixture = [
  {
    id: 'p1',
    text: 'Senior Software Engineer',
    categories: { location: 'Los Gatos, CA', team: 'Streaming' },
    workplaceType: 'hybrid',
    description: '<p>Java and AWS.</p>',
    hostedUrl: 'https://jobs.lever.co/netflix/p1',
    createdAt: 1751328000000,
  },
  {
    id: 'p2',
    text: 'Data Engineer',
    categories: { location: 'Remote' },
    workplaceType: 'remote',
    description: '<p>Spark.</p>',
    applyUrl: 'https://jobs.lever.co/netflix/p2/apply',
  },
];

test('leverUrl builds the postings endpoint', () => {
  assert.equal(leverUrl('netflix'), 'https://api.lever.co/v0/postings/netflix?mode=json');
});

test('parseLever maps a bare-array payload + source metadata', () => {
  const raw = parseLever(fixture, source);
  assert.equal(raw.length, 2);
  const a = raw[0]!;
  assert.equal(a.ats, 'lever');
  assert.equal(a.company, 'Netflix');
  assert.equal(a.atsJobId, 'p1');
  assert.equal(a.title, 'Senior Software Engineer');
  assert.deepEqual(a.locations, ['Los Gatos, CA']);
  assert.equal(a.workplaceType, 'hybrid');
  assert.equal(a.descriptionFormat, 'html');
  assert.ok((a.postedAt ?? '').startsWith('20'), 'createdAt epoch → ISO date');
  assert.equal(raw[1]!.applyUrl, 'https://jobs.lever.co/netflix/p2/apply');
});

test('normalizeJob works on lever output', () => {
  const job = normalizeJob(parseLever(fixture, source)[0]!);
  assert.ok(!/[<>]/.test(job.description), 'HTML stripped');
  assert.equal(job.id.length, 20);
});

test('parseLever tolerates an empty board', () => {
  assert.deepEqual(parseLever([], source), []);
});
