import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCooldown, cooldownMonths, DEFAULT_COOLDOWN_MONTHS } from './cooldowns';

test('Amazon is stage-aware: OA 6mo, onsite 12mo', () => {
  assert.equal(cooldownMonths('Amazon', 'oa'), 6);
  assert.equal(cooldownMonths('Amazon', 'onsite'), 12);
});

test('Amazon OA failure → eligible again ~6 months later', () => {
  const c = computeCooldown('Amazon', [{ company: 'Amazon', type: 'oa', eventAt: '2026-08-01T00:00:00Z' }]);
  assert.ok(c);
  assert.equal(c!.months, 6);
  assert.equal(c!.approx, false);
  const end = new Date(c!.endsAt);
  assert.equal(end.getUTCFullYear(), 2027);
  assert.equal(end.getUTCMonth(), 1); // February (0-indexed)
});

test('Apple: no cooldown on a plain rejection, 6mo after a failed onsite', () => {
  // A generic rejection (different team = no wait) doesn't start a cooldown…
  assert.equal(computeCooldown('Apple', [{ company: 'Apple', type: 'rejected', eventAt: new Date().toISOString() }]), null);
  // …but a failed onsite does (6 months).
  const c = computeCooldown('Apple', [{ company: 'Apple', type: 'interview', eventAt: '2026-08-01T00:00:00Z' }]);
  assert.ok(c);
  assert.equal(c!.months, 6);
  assert.equal(c!.isRange, false);
});

test('Microsoft / Netflix have no cooldown', () => {
  assert.equal(computeCooldown('Microsoft', [{ company: 'Microsoft', type: 'interview', eventAt: new Date().toISOString() }]), null);
  assert.equal(computeCooldown('Netflix', [{ company: 'Netflix', type: 'rejected', eventAt: new Date().toISOString() }]), null);
});

test('Meta is a 6–12 month range', () => {
  const c = computeCooldown('Meta', [{ company: 'Meta', type: 'rejected', eventAt: '2026-08-01T00:00:00Z' }]);
  assert.ok(c);
  assert.equal(c!.isRange, true);
  assert.equal(c!.monthsMin, 6);
  assert.equal(c!.monthsMax, 12);
  assert.equal(c!.months, 12); // conservative end
  assert.equal(c!.approx, false);
  // earliest eligible = +6mo (Feb 2027), latest = +12mo (Aug 2027)
  assert.equal(new Date(c!.endsAtMin).getUTCMonth(), 1);
  assert.equal(new Date(c!.endsAt).getUTCMonth(), 7);
});

test('newly added companies are known (not approx)', () => {
  for (const co of ['LinkedIn', 'Uber', 'Lyft', 'Spotify', 'Oracle', 'Snap', 'Tesla', 'Walmart']) {
    const c = computeCooldown(co, [{ company: co, type: 'rejected', eventAt: new Date().toISOString() }]);
    assert.ok(c, `${co} should have a cooldown`);
    assert.equal(c!.approx, false, `${co} should be a known cooldown`);
  }
});

test('unknown company falls back to the default (approx)', () => {
  assert.equal(cooldownMonths('Some Startup', 'general'), DEFAULT_COOLDOWN_MONTHS);
  const c = computeCooldown('Some Startup', [
    { company: 'Some Startup', type: 'rejected', eventAt: new Date().toISOString() },
  ]);
  assert.ok(c);
  assert.equal(c!.approx, true);
  assert.equal(c!.months, DEFAULT_COOLDOWN_MONTHS);
});

test('applied / offer do not start a cooldown', () => {
  assert.equal(computeCooldown('Amazon', [{ company: 'Amazon', type: 'applied', eventAt: new Date().toISOString() }]), null);
});

test('the most recent trigger sets the clock', () => {
  const c = computeCooldown('Google', [
    { company: 'Google', type: 'oa', eventAt: '2026-01-01T00:00:00Z' },
    { company: 'Google', type: 'interview', eventAt: '2026-06-01T00:00:00Z' },
  ]);
  assert.equal(c!.months, 12); // interview → onsite (12mo), and it's most recent
});
