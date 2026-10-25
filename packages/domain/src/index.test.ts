import { describe, expect, it } from 'vitest';
import { calculateSubtotal, formatMoney, getAvailabilityLabel, getOrderStatusLabel, normalizeAppError } from './index';

describe('commerce domain', () => {
  it('calculates integer minor-unit subtotals', () => {
    expect(calculateSubtotal([{ quantity: 2, unitPriceMinor: 2400 }, { quantity: 1, unitPriceMinor: 1850 }])).toBe(6650);
  });

  it('rejects fractional quantities', () => {
    expect(() => calculateSubtotal([{ quantity: 1.5, unitPriceMinor: 100 }])).toThrow('Invalid cart line');
  });

  it('maps all Doctor availability labels', () => {
    expect(getAvailabilityLabel('available')).toBe('متوفر');
    expect(getAvailabilityLabel('limited')).toBe('محدود');
    expect(getAvailabilityLabel('unavailable')).toBe('غير موجود');
  });

  it('formats configured currency precision', () => {
    expect(formatMoney({ amountMinor: 2400, currency: 'USD', decimalPlaces: 2 }, 'en-US')).toBe('24.00 USD');
  });

  it('formats the internal NEW_SYP display label without guessing a public code', () => {
    expect(formatMoney({ amountMinor: 1250, currency: 'NEW_SYP', decimalPlaces: 0 }, 'en-US')).toBe('1,250 ل.س الجديدة');
  });

  it('maps normal and exceptional Doctor-visible order states', () => {
    expect(getOrderStatusLabel('sourcing')).toBe('جاري تأمين المنتجات');
    expect(getOrderStatusLabel('out_for_delivery')).toBe('قيد التوصيل');
    expect(getOrderStatusLabel('problem')).toBe('مشكلة بالطلب');
  });

  it('normalizes network and session errors to safe Arabic messages', () => {
    expect(normalizeAppError(new Error('Failed to fetch')).kind).toBe('network');
    expect(normalizeAppError(new Error('JWT expired')).kind).toBe('unauthorized');
    expect(normalizeAppError(new Error('Invalid login credentials')).messageAr).toContain('جهّز حساباً جديداً');
    expect(normalizeAppError(new Error('Invalid Refresh Token: Refresh Token Not Found')).kind).toBe('unauthorized');
  });

  it('rejects negative quantities and fractional minor units', () => {
    expect(() => calculateSubtotal([{ quantity: -1, unitPriceMinor: 100 }])).toThrow('Invalid cart line');
    expect(() => calculateSubtotal([{ quantity: 1, unitPriceMinor: 10.5 }])).toThrow('Invalid cart line');
  });
});
