import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCategory, isTechCategory } from './classify';

test('classifies software roles as swe-general', () => {
  assert.equal(classifyCategory('Senior Software Engineer'), 'swe-general');
  assert.equal(classifyCategory('Software Development Engineer, Neural Graph'), 'swe-general');
  assert.equal(classifyCategory('Full Stack Developer'), 'swe-general');
  assert.equal(classifyCategory('Frontend Engineer'), 'swe-general');
  assert.equal(classifyCategory('iOS Engineer'), 'swe-general');
});

test('classifies infra / platform / reliability as swe-infra', () => {
  assert.equal(classifyCategory('Site Reliability Engineer'), 'swe-infra');
  assert.equal(classifyCategory('Platform Engineer'), 'swe-infra');
  assert.equal(classifyCategory('Senior DevOps Engineer'), 'swe-infra');
  assert.equal(classifyCategory('Security Engineer'), 'swe-infra');
});

test('classifies ML / AI roles', () => {
  assert.equal(classifyCategory('Machine Learning Engineer'), 'ml-engineering');
  assert.equal(classifyCategory('Research Scientist, Deep Learning'), 'ml-research');
  assert.equal(classifyCategory('Senior Software Engineer - Agentic AI'), 'ml-engineering');
});

test('classifies data roles', () => {
  assert.equal(classifyCategory('Senior Data Analyst - Finance'), 'data');
  assert.equal(classifyCategory('Data Engineer'), 'data');
  assert.equal(classifyCategory('Data Scientist'), 'data');
});

test('classifies quant roles', () => {
  assert.equal(classifyCategory('Quantitative Trader'), 'quant-trading');
  assert.equal(classifyCategory('Quantitative Researcher'), 'quant-research');
  assert.equal(classifyCategory('Quant Developer'), 'quant-dev');
});

test('classifies hardware / silicon eng as tech (swe-general)', () => {
  assert.equal(classifyCategory('HSIO Functional and Power Management Engineer'), 'swe-general');
  assert.equal(classifyCategory('Senior Verification Engineer, Emulation'), 'swe-general');
  assert.equal(classifyCategory('Senior Power Integrity Co-Design Engineer'), 'swe-general');
});

test('sends non-tech roles to other', () => {
  assert.equal(classifyCategory('Specialty Sales Team Leader - Lebanon, OH'), 'other');
  assert.equal(classifyCategory('Senior Counsel'), 'other');
  assert.equal(classifyCategory('Named Account Executive - Core'), 'other');
  assert.equal(classifyCategory('Senior NPN Program Operations Analyst'), 'other');
  assert.equal(classifyCategory('Vice President, Fraud Attack Response & Insights'), 'other');
});

test('isTechCategory is false only for other', () => {
  assert.equal(isTechCategory('swe-general'), true);
  assert.equal(isTechCategory('other'), false);
});
