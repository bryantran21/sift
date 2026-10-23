import test from 'node:test';
import assert from 'node:assert/strict';
import { companies, findCompany, industryFor, normCompany } from './companies';
import { isIndustry } from './industries';

test('registry has no duplicate companies (by normalized name)', () => {
  const seen = new Map<string, string>();
  for (const c of companies) {
    const k = normCompany(c.name);
    assert.ok(!seen.has(k), `duplicate: "${c.name}" vs "${seen.get(k)}"`);
    seen.set(k, c.name);
  }
});

test('every explicit industry is a valid taxonomy key', () => {
  for (const c of companies) {
    if (c.industry !== undefined) assert.ok(isIndustry(c.industry), `${c.name}: bad industry "${c.industry}"`);
  }
});

test('every company has a domain (needed for its logo)', () => {
  for (const c of companies) assert.ok(c.domain, `${c.name} is missing a domain`);
});

test('name normalization matches the spellings job sources use', () => {
  assert.equal(findCompany('Home Depot')?.name, 'The Home Depot');
  assert.equal(findCompany("Lowe's")?.name, "Lowe's");
  assert.equal(findCompany('Lowes')?.name, "Lowe's");
  assert.equal(findCompany('Lawrence Livermore National Laboratory (LLNL)')?.name, 'Lawrence Livermore National Laboratory');
  assert.equal(findCompany('Nestle')?.name, 'Nestlé');
});

test('aliases resolve to the parent brand', () => {
  assert.equal(findCompany('Burger King')?.name, 'Restaurant Brands International');
  assert.equal(findCompany('Twitter')?.name, 'X');
  assert.equal(findCompany('Disney')?.name, 'Walt Disney');
});

test('industryFor: registry match, then tags, then tech', () => {
  assert.equal(industryFor('Delta Air Lines'), 'airlines');
  assert.equal(industryFor('NVIDIA'), 'semis');
  assert.equal(industryFor('Some Unknown Trading Co', ['quant']), 'quant');
  assert.equal(industryFor('Some Unknown Startup'), 'tech');
});
