import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSalary, parsePayByLocation, formatSalary } from './salary';

// Real formats sampled from ingested descriptions.
const cases: [string, ReturnType<typeof parseSalary>][] = [
  ['Salary Range: $100K–$120K, depending on experience and location', { min: 100000, max: 120000, period: 'year' }],
  [
    'USA base pay range (CA, WA, NY, NJ, CT) per year: $195000 - $255000 USA base pay range (all other U.S. states) per year: $173000 - $233000',
    { min: 173000, max: 255000, period: 'year' },
  ],
  ['Annual Salary: $315,000—$380,000 USD Logistics', { min: 315000, max: 380000, period: 'year' }],
  ['The base salary range for this position is $175,000 to $230,000 annually.', { min: 175000, max: 230000, period: 'year' }],
  ['Compensation: $120k - $170k + bonus.', { min: 120000, max: 170000, period: 'year' }],
  ['Base Salary: $300,000 About Us', { min: 300000, max: 300000, period: 'year' }],
  ['Compensation: $21.50/hour Start Date: As soon as possible', { min: 21.5, max: 21.5, period: 'hour' }],
  ['The salary range for this role is $5,000 - $10,000 per month (Gross in USD)', { min: 5000, max: 10000, period: 'month' }],
  ['Pay Range: Level 3: $165,000.00 - $265,000.00 Your actual level', { min: 165000, max: 265000, period: 'year' }],
  ['New York Pay Range $25—$28 USD', { min: 25, max: 28, period: 'hour' }],
  ['Base Salary: Denver: $70,000; Long Beach: $80,000 ADDITIONAL', { min: 70000, max: 80000, period: 'year' }],
  ['Salary range: Senior Software Engineer: $169,067 - $216,031/ per year.', { min: 169067, max: 216031, period: 'year' }],
  [
    'The base pay for this position ranges from $129,300/year in our lowest geographic market up to $223,600/year in our highest geographic market.',
    { min: 129300, max: 223600, period: 'year' },
  ],
  [
    'For US based applicants, the salary range is $219,989 - $320,613 USD + equity. For Toronto and Vancouver based applicants, the salary range is $282,469 - $329,337 CAD + equity.',
    { min: 219989, max: 320613, period: 'year' },
  ],
];

const AMAZON = `Final compensation will be determined based on factors including experience, qualifications, and location.

USA, CA, PASADENA - 142,800.00 - 193,200.00 USD annually
USA, WA, SEATTLE - 129,300.00 - 223,600.00 USD annually
USA, NY, NEW YORK - 150,100.00 - 230,000.00 USD annually`;

test('parses Amazon-style "N - N USD annually" lines (no dollar sign)', () => {
  assert.deepEqual(parseSalary(AMAZON), { min: 129300, max: 230000, period: 'year' });
});

test('extracts pay per location', () => {
  assert.deepEqual(parsePayByLocation(AMAZON), [
    { location: 'Pasadena, CA', min: 142800, max: 193200, period: 'year' },
    { location: 'Seattle, WA', min: 129300, max: 223600, period: 'year' },
    { location: 'New York, NY', min: 150100, max: 230000, period: 'year' },
  ]);
  assert.deepEqual(parsePayByLocation('Annual Salary: $315,000—$380,000 USD'), []);
  assert.deepEqual(parsePayByLocation(null), []);
});

test('parses real-world pay formats', () => {
  for (const [text, want] of cases) assert.deepEqual(parseSalary(text), want, text);
});

test('ignores money that is not pay', () => {
  assert.equal(parseSalary('Following a $200 million Series B at a $2.2 billion valuation, ACS is expanding.'), null);
  assert.equal(parseSalary('U.S. healthcare wastes more than $350B yearly on administrative work.'), null);
  assert.equal(parseSalary("We've raised over $21M from top-tier investors."), null);
  assert.equal(parseSalary('Canada Pay Range $125,000—$170,000 CAD'), null);
  assert.equal(parseSalary('the potential to earn $15,000 if your referred candidate is hired'), null);
  assert.equal(parseSalary(''), null);
  assert.equal(parseSalary(null), null);
});

test('formats compactly', () => {
  assert.equal(formatSalary({ min: 129300, max: 223600, period: 'year' }), '$129k–$224k/yr');
  assert.equal(formatSalary({ min: 25, max: 28, period: 'hour' }), '$25–$28/hr');
  assert.equal(formatSalary({ min: 300000, max: 300000, period: 'year' }), '$300k/yr');
  assert.equal(formatSalary(null), null);
});
