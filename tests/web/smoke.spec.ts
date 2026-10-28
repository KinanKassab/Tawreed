import { expect, test } from '@playwright/test';

test('lets a configured signed-out visitor browse the Arabic catalog', async ({ page }) => {
  await page.goto('/');

  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page.getByText('المستلزمات الطبية في مكان واحد.', { exact: true })).toBeVisible();
  await page.goto('/catalog');
  await expect(page.getByText('المستلزمات الطبية', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('renders the RTL sign-in surface without horizontal overflow', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByText('توريد', { exact: true })).toBeVisible();
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'الدخول عبر واتساب' })).toHaveCount(0);

  const fontFamily = await page.getByText('توريد', { exact: true }).evaluate((element) =>
    window.getComputedStyle(element).fontFamily,
  );
  expect(fontFamily).toContain('Segoe UI');

  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('presents registration as separate name, contact, and delivery steps', async ({ page }) => {
  await page.goto('/register?returnTo=%2Fcheckout');
  await page.getByLabel('الاسم الأول').fill('طبيب');
  await page.getByLabel('الاسم الثاني').fill('اختبار');
  await page.getByRole('button', { name: 'التالي' }).click();

  await expect(page.getByText('بيانات الدخول والتواصل')).toBeVisible();
  await page.getByLabel('البريد الإلكتروني').fill('doctor-flow@example.test');
  await page.getByLabel('رقم الهاتف').fill('+963900000000');
  await page.getByLabel('كلمة المرور').fill('StrongPassword-123!');
  await page.getByRole('button', { name: 'التالي' }).click();

  await expect(page.getByText('أين نوصّل طلباتك؟')).toBeVisible();
  await expect(page.getByRole('button', { name: 'استخدام موقعي الحالي' })).toBeVisible();
  await page.getByRole('button', { name: 'الموقع غير صحيح؟ حدده على الخريطة' }).click();
  await expect(page.getByRole('button', { name: 'فتح خرائط Google' })).toBeVisible();
});

test('offers account setup after unsuccessful sign-in', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill('not-registered@example.test');
  await page.getByLabel('كلمة المرور').fill('NotRegistered-123!');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  await expect(page.getByRole('alert')).toContainText('تعذر تسجيل الدخول');
  const dialog = page.getByRole('dialog', { name: 'خيارات تجهيز الحساب' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('هل تريد تجهيز حساب جديد؟');
  await dialog.getByRole('button', { name: 'تجهيز حساب جديد' }).click();
  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByLabel('الاسم الأول')).toBeVisible();
  await expect(page.getByLabel('الاسم الثاني')).toBeVisible();
  await expect(page.getByText('الخطوة ١ من ٣')).toBeVisible();
});

test('allows dismissing the account setup popup', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill('not-registered@example.test');
  await page.getByLabel('كلمة المرور').fill('NotRegistered-123!');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  const dialog = page.getByRole('dialog', { name: 'خيارات تجهيز الحساب' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'ليس الآن' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/login$/);
});
