import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveCountry } from './location';

test('detects US from explicit markers and states', () => {
  assert.equal(deriveCountry(['US, CA, Santa Clara']), 'US');
  assert.equal(deriveCountry(['New York City, New York']), 'US');
  assert.equal(deriveCountry(['Washington - Seattle']), 'US');
  assert.equal(deriveCountry(['United States']), 'US');
  assert.equal(deriveCountry(['Remote - US']), 'US');
});

test('detects non-US from country / metro names', () => {
  assert.equal(deriveCountry(['Toronto, Canada']), 'non-US');
  assert.equal(deriveCountry(['India, Bengaluru']), 'non-US');
  assert.equal(deriveCountry(['Israel, Tel Aviv']), 'non-US');
  assert.equal(deriveCountry(['Bogota, Colombia']), 'non-US');
  assert.equal(deriveCountry(['Mexico - Mexico City']), 'non-US');
});

test('ambiguous / bare-remote strings are unknown', () => {
  assert.equal(deriveCountry(['Remote']), 'unknown');
  assert.equal(deriveCountry(['2 Locations']), 'unknown');
  assert.equal(deriveCountry([]), 'unknown');
});

test('US wins when a role is available across US + non-US', () => {
  assert.equal(deriveCountry(['London', 'US, NY, New York']), 'US');
  assert.equal(deriveCountry(['Toronto, Canada', 'Austin, Texas']), 'US');
});

test('does not false-positive on substrings (Columbus, Belarus)', () => {
  assert.equal(deriveCountry(['Columbus, Ohio']), 'US'); // Ohio is a state
  assert.equal(deriveCountry(['Minsk, Belarus']), 'unknown'); // not a US match
});
