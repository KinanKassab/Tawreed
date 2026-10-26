const apiUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const email = process.env.TAWREED_STAFF_EMAIL?.trim().toLowerCase();
const password = process.env.TAWREED_STAFF_PASSWORD;
const rank = process.env.TAWREED_STAFF_RANK?.trim() || 'owner';

if (!apiUrl || !secretKey) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
if (apiUrl.startsWith('http://127.0.0.1:') || apiUrl.startsWith('http://localhost:')) {
  throw new Error('This helper only accepts a hosted Supabase project.');
}
if (!email || !password) throw new Error('Set TAWREED_STAFF_EMAIL and TAWREED_STAFF_PASSWORD.');
if (!['operations_manager', 'admin', 'owner'].includes(rank)) {
  throw new Error('TAWREED_STAFF_RANK must be operations_manager, admin, or owner.');
}
if (password.length < 12) throw new Error('Use a staff password with at least 12 characters.');

const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  'Content-Type': 'application/json',
};
const listedResponse = await fetch(`${apiUrl}/auth/v1/admin/users?page=1&per_page=1000`, { headers });
const listed = await listedResponse.json();
if (!listedResponse.ok) throw new Error(`${listedResponse.status} ${JSON.stringify(listed)}`);

let user = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);
let created = false;
if (!user) {
  const createdResponse = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'فريق توريد' },
    }),
  });
  user = await createdResponse.json();
  if (!createdResponse.ok) throw new Error(`${createdResponse.status} ${JSON.stringify(user)}`);
  created = true;
}

const staffResponse = await fetch(`${apiUrl}/rest/v1/staff_accounts?on_conflict=user_id`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ user_id: user.id, rank, active: true }),
});

if (!staffResponse.ok) {
  if (created) await fetch(`${apiUrl}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers });
  throw new Error(`${staffResponse.status} ${await staffResponse.text()}`);
}

console.log(`Hosted Tawreed staff account is ready: ${email} (${rank}).`);
