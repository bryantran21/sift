import test from 'node:test';
import assert from 'node:assert/strict';
import { poolerUrl } from './client';

test('Supabase session pooler URLs move to the transaction pooler port', () => {
  const s = 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
  assert.equal(poolerUrl(s), 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres');
  const t = 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
  assert.equal(poolerUrl(t), t);
});

test('other hosts are untouched', () => {
  const local = 'postgresql://u:p@localhost:5432/sift';
  assert.equal(poolerUrl(local), local);
  const direct = 'postgresql://postgres:pw@db.abc.supabase.co:5432/postgres';
  assert.equal(poolerUrl(direct), direct);
});
