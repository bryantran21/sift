import test from 'node:test';
import assert from 'node:assert/strict';
import { collapseFanout, renderLocations } from './collapse';
import type { NormalizedJob } from '../types';

function job(over: Partial<NormalizedJob>): NormalizedJob {
  return {
    id: Math.random().toString(36).slice(2),
    company: 'Acme',
    companyTier: 1,
    title: 'Software Engineer',
    normalizedTitle: 'software engineer',
    locations: ['New York'],
    workMode: 'unknown',
    description: 'Build systems with typescript and postgres.',
    descriptionHash: 'h1',
    applyUrl: 'https://example.com/job',
    ats: 'greenhouse',
    atsJobId: 'a',
    reqNumber: null,
    sourceSlug: 'acme',
    postedAt: null,
    category: 'other',
    seniority: 'unknown',
    relevanceScore: 0,
    filterFlags: [],
    ...over,
  };
}

test('collapses same-title postings across cities, unioning locations', () => {
  const out = collapseFanout([
    job({ id: '1', locations: ['New York'], descriptionHash: 'same', description: 'Same JD.' }),
    job({ id: '2', locations: ['Austin'], descriptionHash: 'same', description: 'Same JD.' }),
    job({ id: '3', locations: ['SF'], descriptionHash: 'same', description: 'Same JD.' }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.mergedCount, 3);
  assert.deepEqual([...out[0]!.locations].sort(), ['Austin', 'New York', 'SF']);
});

test('never collapses across different companies', () => {
  const out = collapseFanout([
    job({ id: '1', company: 'Acme', descriptionHash: 'x' }),
    job({ id: '2', company: 'Globex', descriptionHash: 'x' }),
  ]);
  assert.equal(out.length, 2);
});

test('collapses description-less (Workday-style) postings by company+title', () => {
  const out = collapseFanout([
    job({ id: '1', description: '', descriptionHash: '', locations: ['Store A'] }),
    job({ id: '2', description: '', descriptionHash: '', locations: ['Store B'] }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.mergedCount, 2);
});

test('keeps genuinely different roles under the same title apart', () => {
  const out = collapseFanout([
    job({ id: '1', description: 'Frontend React design systems and CSS animations.', descriptionHash: 'a' }),
    job({ id: '2', description: 'Kernel driver low level firmware embedded assembly.', descriptionHash: 'b' }),
  ]);
  assert.equal(out.length, 2);
});

test('collapses by shared req number even when descriptions differ', () => {
  const out = collapseFanout([
    job({ id: '1', reqNumber: 'R100', description: 'alpha', descriptionHash: 'a', locations: ['NYC'] }),
    job({ id: '2', reqNumber: 'R100', description: 'bravo', descriptionHash: 'b', locations: ['LA'] }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.mergedCount, 2);
});

test('renderLocations summarizes beyond the max', () => {
  assert.equal(renderLocations(['A', 'B']), 'A, B');
  assert.equal(renderLocations(['A', 'B', 'C', 'D', 'E', 'F'], 4), 'A, B, C, D +2');
  assert.equal(renderLocations([]), '—');
});
