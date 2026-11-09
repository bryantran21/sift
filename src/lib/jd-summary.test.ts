import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeJd } from './jd-summary';

// Shapes taken from real ingested descriptions (Greenhouse / Ashby / Lever).
const ZSCALER = `Role
Zscaler is looking for a Staff Engineer to join our Identity team.
What you’ll do (Role Expectations)
Lead the development of identity management products for Zscaler
Design scalable services handling millions of requests
Who You Are (Success Profile)
You thrive in ambiguity and own outcomes.
What We’re Looking for (Minimum Qualifications)
8+ years of experience building distributed systems in Go or Java
Good understanding of CI/CD tools and processes
Hands-on experience with SQL and Postgres
What Will Make You Stand Out (Preferred Qualifications)
Experience with OAuth, SAML, or OIDC
Benefits
Various health plans
Time off plans for vacation and sick time
Parental leave options
Retirement options
Education reimbursement
Candidates must be authorized to work in the U.S. without the need for current or future visa sponsorship.`;

const KAYAK = `KAYAK is hiring.
In this role you will:
- Build ads ranking services in Java
- Work with product and data science
Please apply if you have:
- 3-5 years of professional Java experience
- Professional proficiency in written and spoken English
Benefits:
Work from (almost) anywhere for up to 20 days per year
Funds for your career growth
Generous additional Health Insurance
Equity and an annual bonus`;

test('splits a posting into responsibilities / requirements / nice-to-have', () => {
  const s = summarizeJd(ZSCALER);
  assert.deepEqual(
    s.sections.map((x) => x.kind),
    ['responsibilities', 'requirements', 'nice', 'benefits'],
  );
  const req = s.sections.find((x) => x.kind === 'requirements')!;
  assert.ok(req.bullets.some((b) => b.startsWith('8+ years')));
  // "Who You Are" merges into requirements
  assert.ok(req.bullets.some((b) => b.startsWith('You thrive')));
  assert.equal(s.sections.find((x) => x.kind === 'nice')!.bullets[0], 'Experience with OAuth, SAML, or OIDC');
});

test('extracts sponsorship, experience, and benefits', () => {
  const z = summarizeJd(ZSCALER);
  assert.equal(z.sponsorship, 'no');
  assert.equal(z.experience, '8+ yrs');
  assert.ok(z.benefits.includes('Health insurance'));
  assert.ok(z.benefits.includes('Parental leave'));
  assert.ok(z.benefits.includes('401(k) / retirement'));
  assert.ok(z.benefits.includes('Learning budget'));
  assert.ok(z.benefits.includes('Paid time off'));

  const k = summarizeJd(KAYAK);
  assert.equal(k.experience, '3–5 yrs');
  assert.equal(k.sponsorship, null);
  assert.ok(k.benefits.includes('Equity'));
  assert.ok(k.benefits.includes('Bonus'));
  assert.ok(k.benefits.includes('Learning budget'));
  assert.deepEqual(k.sections[0]!.bullets, ['Build ads ranking services in Java', 'Work with product and data science']);
});

test('clearance and sponsorship-available are detected', () => {
  assert.equal(summarizeJd('Requirements\nActive TS/SCI clearance required').clearance, true);
  assert.equal(summarizeJd('We sponsor visas. Visa sponsorship is available for this role.').sponsorship, 'yes');
});

test('no structure → empty sections, nothing invented', () => {
  const s = summarizeJd('We build rockets. Join us to build more rockets with great people.');
  assert.deepEqual(s.sections, []);
  assert.equal(s.experience, null);
  assert.deepEqual(summarizeJd(''), { sections: [], benefits: [], sponsorship: null, clearance: false, experience: null });
});

test('company tenure is not mistaken for a requirement', () => {
  assert.equal(summarizeJd('For over 100 years we have served customers.').experience, null);
});
