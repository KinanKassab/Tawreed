import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const email = process.env.TAWREED_STAFF_EMAIL?.trim();
const password = process.env.TAWREED_STAFF_PASSWORD;
const rank = process.env.TAWREED_STAFF_RANK?.trim() || 'owner';
if (!email || !password) throw new Error('Set TAWREED_STAFF_EMAIL and TAWREED_STAFF_PASSWORD for the local staff account.');
if (!['operations_manager', 'admin', 'owner'].includes(rank)) throw new Error('TAWREED_STAFF_RANK must be operations_manager, admin, or owner.');
if (password.length < 12) throw new Error('Use a local staff password with at least 12 characters.');

const root = resolve(import.meta.dirname, '..');
const cliEntry = resolve(root, 'node_modules/supabase/dist/supabase.js');
const status = execFileSync(process.execPath, [cliEntry, 'status', '-o', 'env'], { cwd: root, encoding: 'utf8' });
const local = Object.fromEntries(status.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  return match ? [[match[1], match[2].replace(/^"|"$/g, '')]] : [];
}));
if (!local.API_URL?.startsWith('http://127.0.0.1:') || !local.SERVICE_ROLE_KEY) throw new Error('Local Supabase is not available. This helper refuses non-local projects.');

const headers = { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
let userId;
try {
  const createdResponse = await fetch(`${local.API_URL}/auth/v1/admin/users`, {
    method: 'POST', headers,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: 'فريق توريد' } }),
  });
  const created = await createdResponse.json();
  if (!createdResponse.ok) throw new Error(`${createdResponse.status} ${JSON.stringify(created)}`);
  userId = created.id;
  const staffResponse = await fetch(`${local.API_URL}/rest/v1/staff_accounts`, {
    method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: userId, rank }),
  });
  if (!staffResponse.ok) throw new Error(`${staffResponse.status} ${await staffResponse.text()}`);
  console.log(`Created local Tawreed staff account ${email} with rank ${rank}.`);
} catch (error) {
  if (userId) await fetch(`${local.API_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers });
  throw error;
}
