import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySeniority } from './seniority';

test('detects interns', () => {
  assert.equal(classifySeniority('Software Engineer Intern'), 'intern');
  assert.equal(classifySeniority('2027 Internship - Frontend & User Experience'), 'intern');
  assert.equal(classifySeniority('Hardware Co-Op'), 'intern');
});

test('detects staff+ (staff / principal / distinguished)', () => {
  assert.equal(classifySeniority('Staff Software Engineer, Environments'), 'staff+');
  assert.equal(classifySeniority('Principal Engineer'), 'staff+');
  assert.equal(classifySeniority('Distinguished Engineer'), 'staff+');
  assert.equal(classifySeniority('Software Engineer IV'), 'staff+');
});

test('detects senior', () => {
  assert.equal(classifySeniority('Senior Software Engineer'), 'senior');
  assert.equal(classifySeniority('Sr. Data Engineer'), 'senior');
  assert.equal(classifySeniority('Lead Backend Engineer'), 'senior');
  assert.equal(classifySeniority('Software Engineer III'), 'senior');
});

test('detects new-grad / entry', () => {
  assert.equal(classifySeniority('New Grad Software Engineer'), 'new-grad');
  assert.equal(classifySeniority('Software Engineer, University Graduate'), 'new-grad');
  assert.equal(classifySeniority('Junior Developer'), 'new-grad');
  assert.equal(classifySeniority('Entry-Level Software Engineer'), 'new-grad');
  assert.equal(classifySeniority('Software Engineer I'), 'new-grad');
});

test('detects mid level', () => {
  assert.equal(classifySeniority('Software Engineer II'), 'mid');
  assert.equal(classifySeniority('Mid-Level Backend Engineer'), 'mid');
});

test('senior word outranks a level number', () => {
  assert.equal(classifySeniority('Senior Software Engineer II'), 'senior');
  assert.equal(classifySeniority('Senior Staff Software Engineer'), 'staff+');
});

test('no level signal → unknown', () => {
  assert.equal(classifySeniority('Software Engineer'), 'unknown');
  assert.equal(classifySeniority('Machine Learning Engineer'), 'unknown');
});

test('does not false-match "intern" inside "internal"', () => {
  assert.equal(classifySeniority('Internal Tools Engineer'), 'unknown');
});
