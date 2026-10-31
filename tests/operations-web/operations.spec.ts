import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const apiUrl = process.env.OPERATIONS_TEST_API_URL!;
const serviceRoleKey = process.env.OPERATIONS_TEST_SERVICE_ROLE_KEY!;
const publishableKey = process.env.OPERATIONS_TEST_PUBLISHABLE_KEY!;

async function json(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

test.describe('لوحة العمليات', () => {
  let userId = '';
  let ownerAccessToken = '';
  const email = `operations-web-${crypto.randomUUID()}@example.test`;
  const password = `Local-${crypto.randomUUID()}-9a!`;
  const targetProductId = '20000000-0000-0000-0000-000000000001';
  const targetSku = 'TWD-DEN-0001';

  test.beforeAll(async () => {
    const user = await json(await fetch(`${apiUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: 'مالك فحص الواجهة' } }),
    }));
    userId = user.id;
    await json(await fetch(`${apiUrl}/rest/v1/staff_accounts`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, rank: 'owner' }),
    }));
    const session = await json(await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }));
    ownerAccessToken = session.access_token;
  });

  test.afterAll(async () => {
    if (!userId) return;
    await fetch(`${apiUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
  });

  test('يدخل المالك ويرى أقسام التشغيل', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور').fill(password);
    await page.getByRole('button', { name: 'دخول آمن' }).click();
    await expect(page.getByText('نظرة عامة', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('المالك', { exact: true })).toBeVisible();
    await expect(page.getByText('طلبات جديدة', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /الطلبات/ }).click();
    await expect(page.getByText('لا توجد طلبات', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /الكتالوج والأسعار/ }).click();
    await page.getByLabel('بحث بالاسم أو SKU').fill(targetSku);
    await expect(page.getByText(targetSku, { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /سعر الصرف/ }).click();
    await expect(page.getByLabel('كل 1 USD يساوي')).toHaveValue('100');
  });

  test('يرفض حساب الطبيب غير المخوّل', async ({ page }) => {
    const doctorEmail = `operations-doctor-${crypto.randomUUID()}@example.test`;
    const doctorPassword = `Local-${crypto.randomUUID()}-9a!`;
    const doctor = await json(await fetch(`${apiUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: doctorEmail, password: doctorPassword, email_confirm: true, user_metadata: { full_name: 'طبيب غير مخول' } }),
    }));
    try {
      await page.goto('/login');
      await page.getByLabel('البريد الإلكتروني').fill(doctorEmail);
      await page.getByLabel('كلمة المرور').fill(doctorPassword);
      await page.getByRole('button', { name: 'دخول آمن' }).click();
      await expect(page.getByText('هذا الحساب غير مخوّل للدخول إلى لوحة توريد الداخلية.')).toBeVisible();
    } finally {
      await fetch(`${apiUrl}/auth/v1/admin/users/${doctor.id}`, {
        method: 'DELETE',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
    }
  });

  test('يعدّل المنتج ويعاينه ويقص صورته ويحفظها', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور').fill(password);
    await page.getByRole('button', { name: 'دخول آمن' }).click();
    await expect(page.getByText('نظرة عامة', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /الكتالوج والأسعار/ }).click();
    await page.getByLabel('بحث بالاسم أو SKU').fill(targetSku);
    await expect(page.getByText(targetSku, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'تعديل', exact: true }).click();

    await page.getByLabel('اسم المنتج').fill('منتج محرر من لوحة العمليات');
    await page.getByLabel('سعر البيع (SYP)').fill('45775');
    await page.getByLabel('سعر البيع (SYP)').blur();
    await page.getByLabel('سعر التكلفة (SYP)').fill('25000');
    await page.getByLabel('الكمية الموجودة').fill('20');
    await page.getByLabel('حد التنبيه').fill('4');
    await page.getByLabel('الوصف الظاهر في تطبيق الدكتور').fill('وصف محدث يظهر مباشرة في صفحة المنتج لدى الطبيب.');
    await page.getByLabel('سبب تعديل المخزون (عند تغيير الكمية)').fill('اختبار إدارة المنتج المتكاملة');
    await page.getByRole('button', { name: 'متوفر', exact: true }).click();

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'اختيار صورة من الجهاز' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(resolve(import.meta.dirname, '../../apps/doctor/assets/images/app-icon-1024.png'));
    await expect(page.getByLabel('منطقة قص الصورة')).toBeVisible();
    await page.getByRole('button', { name: '+ تكبير' }).click();
    await page.getByRole('button', { name: 'اعتماد القص' }).click();
    await expect(page.getByText('تكبير 120٪')).toBeVisible();

    await page.getByRole('button', { name: 'معاينة المنتج', exact: true }).last().click();
    await expect(page.getByText('معاينة للتعديلات غير المحفوظة')).toBeVisible();
    await expect(page.getByText('منتج محرر من لوحة العمليات', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('45,800 SYP', { exact: true }).last()).toBeVisible();
    await page.getByLabel('إغلاق المعاينة').click();

    await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
    await expect(page.getByText('تم حفظ معلومات المنتج وصورته بنجاح.')).toBeVisible({ timeout: 30_000 });

    const productRows = await json(await fetch(`${apiUrl}/rest/v1/products?id=eq.${targetProductId}&select=name_ar,description_ar,low_stock_threshold,product_prices(amount_minor,currency,active),product_media(media_assets(object_key,width,height))`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${ownerAccessToken}` },
    }));
    expect(productRows[0].name_ar).toBe('منتج محرر من لوحة العمليات');
    expect(productRows[0].description_ar).toContain('يظهر مباشرة');
    expect(productRows[0].low_stock_threshold).toBe(4);
    expect(productRows[0].product_prices.find((price: { active: boolean; currency: string }) => price.active && price.currency === 'NEW_SYP')?.amount_minor).toBe(45800);
    const media = productRows[0].product_media[0].media_assets;
    expect(media.width).toBe(1200);
    expect(media.height).toBe(1200);
    const storedImage = await fetch(`${apiUrl}/storage/v1/object/public/product-media/${media.object_key}`);
    expect(storedImage.ok).toBe(true);
    expect(storedImage.headers.get('content-type')).toContain('image/webp');

    const costs = await json(await fetch(`${apiUrl}/rest/v1/product_costs?product_id=eq.${targetProductId}&active=eq.true&select=amount_minor`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${ownerAccessToken}` },
    }));
    expect(costs[0].amount_minor).toBe(2500);
  });
});
