import test from 'node:test';
import assert from 'node:assert/strict';
import { shortLocation } from './short-location';

test('every spelling of a US city collapses to "City, ST"', () => {
  for (const s of [
    'Seattle, Washington, USA',
    'US, WA, Seattle',
    'USA, WA, SEATTLE',
    'Seattle, WA, United States',
    'Seattle, WA',
    'Seattle, Washington, United States of America',
  ]) {
    assert.equal(shortLocation(s), 'Seattle, WA', s);
  }
  assert.equal(shortLocation('Washington D.C., District of Columbia, United States of America'), 'Washington D.C., DC');
  assert.equal(shortLocation('McLean, Virginia, USA'), 'McLean, VA');
});

test('per-state remote listings collapse to one "Remote (US)"', () => {
  assert.equal(shortLocation('Work at Home, Illinois, United States'), 'Remote (US)');
  assert.equal(shortLocation('Work At Home, Wyoming, United States'), 'Remote (US)');
  assert.equal(shortLocation('Remote, CA'), 'Remote (US)');
});

test('non-US or unrecognized strings are left as-is', () => {
  assert.equal(shortLocation('Toronto, Ontario, Canada'), 'Toronto, Ontario, Canada');
  assert.equal(shortLocation('Remote'), 'Remote');
  assert.equal(shortLocation('5 Locations'), '5 Locations');
  assert.equal(shortLocation('Bengaluru, Karnataka, India'), 'Bengaluru, Karnataka, India');
});
