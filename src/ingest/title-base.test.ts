import test from 'node:test';
import assert from 'node:assert/strict';
import { baseTitle, baseTitleDisplay } from './title-base';

// Real titles from the feed.
const cases: [string, string][] = [
  ['Software Development Engineer, AWS Lambda', 'software development engineer'],
  ['AWS Marketplace - Software Development Engineer, Marketplace', 'software development engineer'],
  ['Software Development Engineer II, Prime Video', 'software development engineer ii'],
  ['Alarm & Accessories - Sr. Embedded SDE , Ring', 'senior embedded sde'],
  ['Data Engineer II, Sales Data Services (SDS)', 'data engineer ii'],
  ['Applied Scientist III, Foundation AI Assets (FAI)', 'applied scientist iii'],
  ['Senior Software Engineer - IOS Developer', 'senior software engineer'],
  ['Software Dev Engineer II, Devices', 'software development engineer ii'],
  ['Data Scientist , Leo Customer Terminal', 'data scientist'],
  ['Member of Technical Staff', 'member of technical staff'],
  ['Staff Software Engineer (Platform - Financial Engineering)', 'staff software engineer'],
  ['C++ Developer', 'c++ developer'],
];

test('strips team/org decorations to the base role', () => {
  for (const [title, want] of cases) assert.equal(baseTitle(title), want, title);
});

test('levels are kept apart', () => {
  assert.notEqual(baseTitle('Software Development Engineer'), baseTitle('Software Development Engineer II'));
  assert.notEqual(baseTitle('Software Engineer'), baseTitle('Senior Software Engineer'));
});

test('spelling variants land together', () => {
  assert.equal(baseTitle('Sr. Software Engineer, Ads'), baseTitle('Senior Software Engineer - Search'));
  assert.equal(baseTitle('Software Dev Engineer'), baseTitle('Software Development Engineer, Alexa'));
});

test('display keeps original casing of the role segment', () => {
  assert.equal(baseTitleDisplay('AWS Marketplace - Software Development Engineer, Marketplace'), 'Software Development Engineer');
  assert.equal(baseTitleDisplay('Just A Title'), 'Just A Title');
});
