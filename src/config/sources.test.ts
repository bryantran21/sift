import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSources, registrySources, TECH_SEARCH } from './sources';
import { findCompany } from '../data/companies';

test('registry Workday boards at non-tech companies query tech terms', () => {
  const target = registrySources().find((s) => s.company === 'Target');
  assert.ok(target, 'Target (retail, Workday) should be a registry source');
  assert.equal(target!.ats, 'workday');
  assert.deepEqual(target!.search, TECH_SEARCH);
});

test('registry Workday boards at tech companies page the whole board', () => {
  const nvidia = registrySources().find((s) => s.company === 'NVIDIA');
  assert.ok(nvidia);
  assert.equal(nvidia!.search, undefined);
});

test('every registry board has a unique ats:slug (dedupe would silently drop a collision)', () => {
  const seen = new Map<string, string>();
  for (const s of registrySources()) {
    const key = `${s.ats}:${s.slug}`;
    assert.ok(!seen.has(key), `${key} used by both ${seen.get(key)} and ${s.company}`);
    seen.set(key, s.company);
  }
});

test('registry sources carry the registry industry', () => {
  for (const s of registrySources()) assert.ok(s.industry, `${s.company} has no industry`);
});

test('merged sources never ingest the same board or curated company twice', () => {
  const sources = loadSources();
  const keys = sources.map((s) => `${s.ats}:${s.slug}`);
  assert.equal(new Set(keys).size, keys.length, 'duplicate ats:slug');

  // A company with a curated board must not also get a registry board under another slug.
  const curatedCompanies = new Set(
    loadSources('sources.yaml').map((s) => findCompany(s.company)?.name).filter(Boolean),
  );
  const fromRegistry = new Set(registrySources().map((s) => `${s.ats}:${s.slug}`));
  for (const s of sources) {
    if (!fromRegistry.has(`${s.ats}:${s.slug}`)) continue;
    const curatedKey = loadSources('sources.yaml').find((c) => findCompany(c.company)?.name === s.company);
    if (curatedCompanies.has(s.company)) {
      assert.equal(`${curatedKey!.ats}:${curatedKey!.slug}`, `${s.ats}:${s.slug}`, `${s.company} ingested twice`);
    }
  }
});
