// Runs only against local Supabase and freshly exported apps. Creates its own
// users/product/orders, exercises the real browser/API/database, then cleans up.
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const statusResult = spawnSync(process.execPath, [resolve(root, 'node_modules/supabase/dist/supabase.js'), 'status', '-o', 'json'], { encoding: 'utf8', cwd: root });
if (statusResult.status !== 0) throw new Error('Start local Supabase before running rewards browser checks.');
const status = JSON.parse(statusResult.stdout);
if (new URL(status.API_URL).hostname !== '127.0.0.1') throw new Error('Local Supabase required');
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const adminKey = status.SERVICE_ROLE_KEY;
const users = []; const productId = randomUUID(); const suffix = randomUUID().slice(0, 8);
const output = resolve(root, '.tawreed-local/rewards-preview'); mkdirSync(output, { recursive: true });
const sql = (query) => {
  const result = spawnSync('C:/Program Files/PostgreSQL/18/bin/psql.exe', [status.DB_URL, '-X', '-w', '-q', '-At', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
  if (result.status !== 0) throw new Error(result.stderr); return result.stdout.trim();
};
async function api(path, body, token = adminKey) {
  const response = await fetch(`${status.API_URL}${path}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(result)}`); return result;
}
const reward = (session, action, input = {}) => api('/rest/v1/rpc/reward_api', { p_action: action, p_input: input }, session.access_token);
async function createUser(name) {
  const email = `rewards-${name}-${suffix}@example.test`; const password = `Reward-${randomUUID()}-9a!`;
  const user = await api('/auth/v1/admin/users', { email, password, email_confirm: true, user_metadata: { full_name: name === 'buyer' ? 'مشتري متابعة الكوبون' : name === 'friend' ? 'صاحب كود التجربة' : 'مدير متابعة الكوبونات' } }); users.push(user.id);
  const session = await api('/auth/v1/token?grant_type=password', { email, password }, key);
  return { id: user.id, session };
}
async function serve(directory, port) {
  const base = resolve(root, directory);
  const server = createServer((request, response) => {
    if (request.url.startsWith('/_vercel/')) { response.writeHead(204).end(); return; }
    let path = resolve(base, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!path.startsWith(base)) { response.writeHead(403).end(); return; }
    if (existsSync(path + '.html')) path += '.html';
    if (!existsSync(path) || statSync(path).isDirectory()) path = resolve(base, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  });
  await new Promise((done) => server.listen(port, '127.0.0.1', done)); return server;
}
let browser; const servers = []; const runtimeErrors = [];
try {
  const buyer = await createUser('buyer'); const friend = await createUser('friend'); const admin = await createUser('admin');
  sql(`insert into public.staff_accounts(user_id,rank) values('${admin.id}','owner');
    update public.profiles set default_address='دمشق عنوان التجربة الكامل',phone='+963900000001' where id in ('${buyer.id}','${friend.id}');
    insert into public.products(id,sku,name_ar,unit_label_ar,category_id,availability) select '${productId}','REWARD-${suffix}','منتج اختبار متابعة الكوبونات','قطعة',id,'available' from public.categories limit 1;
    insert into public.product_prices(product_id,currency,amount_minor,decimal_places) values('${productId}','USD',10000,2);
    insert into public.inventory_balances(warehouse_id,product_id,on_hand) select id,'${productId}',100 from public.warehouses where active limit 1;`);
  const friendWallet = await reward(friend.session, 'wallet');
  servers.push(await serve('apps/doctor/dist', 4175), await serve('apps/operations/dist', 4176));
  browser = await chromium.launch({ headless: true });
  async function pageFor(user, port, path, cart = false) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ session, product, cart }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
      if (cart) localStorage.setItem('tawreed-cart-v2', JSON.stringify({ state: { items: { [product]: 1 }, bundles: [] }, version: 0 }));
    }, { session: user.session, product: productId, cart });
    const page = await context.newPage();
    page.on('pageerror', (error) => { runtimeErrors.push(error.message); console.error('Browser error:', error.stack); });
    page.on('response', (response) => { if (response.status() >= 400 && response.url().startsWith(status.API_URL)) console.error('API failure:', response.status(), new URL(response.url()).pathname); });
    await page.goto(`http://127.0.0.1:${port}${path}`); return page;
  }
  const checkout = await pageFor(buyer, 4175, '/checkout', true);
  await checkout.getByLabel('كود صديقك أو كوبون خصم', { exact: true }).fill(friendWallet.code);
  await checkout.getByRole('button', { name: 'تطبيق الكود', exact: true }).click();
  await expect(checkout.getByText(/متاح 2 استخدام/)).toBeVisible();
  await expect(checkout.getByRole('button', { name: 'إرسال الطلب', exact: true })).toBeEnabled();
  await checkout.screenshot({ path: resolve(output, 'checkout.png'), fullPage: true });
  const placed = checkout.waitForResponse((response) => response.url().endsWith('/rpc/reward_api') && response.request().postDataJSON()?.p_action === 'place');
  await checkout.getByRole('button', { name: 'إرسال الطلب', exact: true }).click();
  const result = await (await placed).json(); if (!result.orderId) throw new Error(JSON.stringify(result));
  await expect(checkout).toHaveURL(/order-success/);
  const operations = await pageFor(admin, 4176, '/dashboard');
  await operations.getByRole('tab', { name: 'الكوبونات والنقاط', exact: true }).click();
  await expect(operations.getByText('مشتري متابعة الكوبون', { exact: false }).first()).toBeVisible();
  await expect(operations.getByText('صاحب الكود: صاحب كود التجربة', { exact: true })).toBeVisible();
  await operations.getByRole('button', { name: 'عرض المشتريات (1)', exact: true }).click();
  await expect(operations.getByText('منتج اختبار متابعة الكوبونات', { exact: true })).toBeVisible();
  await operations.screenshot({ path: resolve(output, 'tracking-desktop.png'), fullPage: true });
  await operations.getByLabel('بحث بالمشتري، الهاتف، صاحب الكود، الكود أو رقم الطلب').fill('no-match-for-rewards');
  await operations.getByRole('button', { name: 'تطبيق البحث', exact: true }).click();
  await expect(operations.getByText('لا توجد استخدامات مطابقة', { exact: true })).toBeVisible();
  await operations.getByRole('button', { name: 'مسح الفلاتر', exact: true }).click();
  await expect(operations.getByText('صاحب الكود: صاحب كود التجربة', { exact: true })).toBeVisible();
  await operations.setViewportSize({ width: 375, height: 812 });
  await operations.screenshot({ path: resolve(output, 'tracking-mobile.png'), fullPage: true });
  if (await operations.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile page overflows horizontally');
  // Complete delivery through the existing staff API, then collect through the UI.
  await api('/rest/v1/rpc/operations_confirm_order', { p_order_id: result.orderId, p_doctor_message_ar: null }, admin.session.access_token);
  for (const state of ['ready_for_delivery', 'out_for_delivery', 'delivered']) await api('/rest/v1/rpc/operations_set_order_status', { p_order_id: result.orderId, p_status: state, p_doctor_message_ar: null }, admin.session.access_token);
  await operations.getByRole('button', { name: 'تحديث', exact: true }).click();
  await operations.getByRole('button', { name: 'تأكيد تحصيل قيمة الطلب وإتاحة النقاط', exact: true }).click();
  await expect.poll(async () => (await reward(friend.session, 'wallet')).available).toBe(9.9);
  const wallet = await pageFor(friend, 4175, '/rewards');
  await expect(wallet.getByText('نقاط متاحة', { exact: true })).toBeVisible();
  await wallet.screenshot({ path: resolve(output, 'wallet.png'), fullPage: true });
  await wallet.setViewportSize({ width: 375, height: 812 });
  await wallet.screenshot({ path: resolve(output, 'wallet-mobile.png'), fullPage: true });
  if (await wallet.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile wallet overflows horizontally');
  // Redeem earned points in a real second checkout.
  const redeem = await pageFor(friend, 4175, '/checkout', true);
  await redeem.getByLabel('نقاط بدك تصرفها (اختياري)', { exact: true }).fill('9');
  await redeem.getByRole('button', { name: 'تطبيق النقاط', exact: true }).click();
  await expect(redeem.getByText(/النقاط المختارة: 9/)).toBeVisible();
  await expect(redeem.getByRole('button', { name: 'إرسال الطلب', exact: true })).toBeEnabled();
  const redeemed = redeem.waitForResponse((response) => response.url().endsWith('/rpc/reward_api') && response.request().postDataJSON()?.p_action === 'place');
  await redeem.getByRole('button', { name: 'إرسال الطلب', exact: true }).click();
  const second = await (await redeemed).json(); if (!second.orderId) throw new Error(JSON.stringify(second));
  await expect.poll(async () => (await reward(friend.session, 'wallet')).available).toBe(0.9);
  const request = { items: [{ productId, quantity: 1 }], bundleIds: [], displayCurrency: 'NEW_SYP', deliveryAddress: 'دمشق عنوان التجربة الكامل', recipientName: 'مستخدم اختبار التزامن', recipientPhone: '+963900000001', points: 0, code: friendWallet.code };
  const sameRequest = { ...request, idempotencyKey: randomUUID() };
  const replays = await Promise.all([reward(buyer.session, 'place', sameRequest), reward(buyer.session, 'place', sameRequest)]);
  if (replays[0].orderId !== replays[1].orderId) throw new Error('Concurrent retry created duplicate orders');
  const limited = await Promise.allSettled([reward(buyer.session, 'place', { ...request, idempotencyKey: randomUUID() }), reward(buyer.session, 'place', { ...request, idempotencyKey: randomUUID() })]);
  if (!limited.every((item) => item.status === 'rejected' && item.reason.message.includes('COUPON_LIMIT'))) throw new Error('Third-use limit failed under concurrency');
  const spending = await Promise.allSettled([1, 2].map(() => reward(friend.session, 'place', { ...request, code: '', points: 0.8, idempotencyKey: randomUUID() })));
  if (spending.filter((item) => item.status === 'fulfilled').length !== 1 || !spending.some((item) => item.status === 'rejected' && item.reason.message.includes('POINTS_INVALID'))) throw new Error('Concurrent spending exceeded wallet balance');
  if (runtimeErrors.length) throw new Error(`Browser runtime errors: ${runtimeErrors.join('; ')}`);
  console.log('Browser checks passed: coupon checkout → staff tracking/items/search/mobile → delivery/collection → points wallet → points checkout.');
  console.log('Concurrent requests passed: same-key retry, two-use limit, and wallet overspending prevention.');
} catch (error) {
  if (browser) for (const [index, context] of browser.contexts().entries()) for (const page of context.pages()) {
    console.error('Page state:', page.url(), (await page.locator('body').innerText()).slice(-4000));
    await page.screenshot({ path: resolve(output, `failure-${index}.png`), fullPage: true });
  }
  throw error;
} finally {
  await browser?.close(); for (const server of servers) await new Promise((done) => server.close(done));
  if (users.length) {
    const ids = users.map((id) => `'${id}'`).join(',');
    sql(`delete from public.reward_transactions where buyer_id in (${ids}) or owner_id in (${ids});
      delete from public.order_inventory_reservations where order_id in (select id from public.orders where user_id in (${ids}));
      delete from public.orders where user_id in (${ids});
      delete from public.reward_coupons where owner_id in (${ids}); delete from public.reward_wallets where user_id in (${ids});
      delete from public.inventory_movements where product_id='${productId}'; delete from public.inventory_balances where product_id='${productId}';
      delete from public.products where id='${productId}'; delete from public.audit_events where actor_user_id in (${ids});`);
    for (const id of users) await fetch(`${status.API_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${adminKey}` } });
  }
}
