// Runs transactional fixtures on local Supabase. Every test write is rolled back.
// Apply local migrations before running.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const statusResult = spawnSync(process.execPath, [resolve(root, 'node_modules/supabase/dist/supabase.js'), 'status', '-o', 'json'], { encoding: 'utf8', cwd: root });
if (statusResult.status !== 0) throw new Error('Start local Supabase before running rewards tests.');
const status = JSON.parse(statusResult.stdout);
if (!['127.0.0.1', 'localhost'].includes(new URL(status.DB_URL).hostname)) throw new Error('Local database required.');
const psql = process.env.TAWREED_TEST_PSQL ?? 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const result = spawnSync(psql, [status.DB_URL, '-X', '-w', '-v', 'ON_ERROR_STOP=1', '-q', '-f', resolve(root, 'scripts/test-fixtures/rewards.sql')], { encoding: 'utf8', env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
console.log(result.stderr.split('\n').filter((line) => /PASS:|ERROR:|CONTEXT:/.test(line)).join('\n'));
if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Rewards database checks failed.');
console.log('Local Supabase rewards integration checks passed; all fixture writes rolled back.');
