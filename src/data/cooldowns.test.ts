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

test('Apple has no company-wide cooldown', () => {
  assert.equal(computeCooldown('Apple', [{ company: 'Apple', type: 'rejected', eventAt: new Date().toISOString() }]), null);
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
