import { expect, test } from '@playwright/test';

test('routes a configured signed-out user to Arabic sign-in', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('renders the RTL sign-in surface without horizontal overflow', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByText('توريد', { exact: true })).toBeVisible();
  await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
  await expect(page.getByLabel('كلمة المرور')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible();

  const fontFamily = await page.getByText('توريد', { exact: true }).evaluate((element) =>
    window.getComputedStyle(element).fontFamily,
  );
  expect(fontFamily).toContain('Segoe UI');

  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  );
  expect(overflow).toBeLessThanOrEqual(1);
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
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('button', { name: 'تجهيز الحساب' })).toBeVisible();
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
