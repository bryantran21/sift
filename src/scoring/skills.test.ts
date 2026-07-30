import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSkills } from './skills';

test('extracts common languages and frameworks', () => {
  const s = extractSkills(
    'We use Python and TypeScript with React and Node.js. Experience with PostgreSQL and Redis a plus.',
  );
  assert.ok(s.includes('Python'));
  assert.ok(s.includes('TypeScript'));
  assert.ok(s.includes('React'));
  assert.ok(s.includes('Node.js'));
  assert.ok(s.includes('PostgreSQL'));
  assert.ok(s.includes('Redis'));
});

test('extracts ML + infra terms', () => {
  const s = extractSkills('Build ML systems with PyTorch. Deploy on Kubernetes and AWS using Docker and CI/CD.');
  assert.ok(s.includes('PyTorch'));
  assert.ok(s.includes('Machine Learning') === false); // "ML" alone isn't in phrase form here
  assert.ok(s.includes('Kubernetes'));
  assert.ok(s.includes('AWS'));
  assert.ok(s.includes('Docker'));
  assert.ok(s.includes('CI/CD'));
});

test('handles special-character tokens', () => {
  assert.deepEqual(extractSkills('Strong C++ and C# background.').sort(), ['C#', 'C++']);
  assert.ok(extractSkills('.NET and gRPC services').includes('.NET'));
});

test('does not match Java inside JavaScript', () => {
  const s = extractSkills('Frontend role: JavaScript, HTML, CSS.');
  assert.ok(s.includes('JavaScript'));
  assert.ok(!s.includes('Java'));
});

test('deduplicates and returns empty for no matches', () => {
  assert.deepEqual(extractSkills('Python, python, PYTHON'), ['Python']);
  assert.deepEqual(extractSkills('A friendly team player who loves coffee.'), []);
  assert.deepEqual(extractSkills(''), []);
});
