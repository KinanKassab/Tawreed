import { describe, expect, it } from 'vitest';
import { calculateSubtotal, formatMoney, getAvailabilityLabel, getOrderStatusLabel, getOrderTrackingStep, normalizeAppError, roundSypTo50 } from './index';

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

  it('formats SYP and rounds operational prices to the nearest 50', () => {
    expect(formatMoney({ amountMinor: 1250, currency: 'NEW_SYP', decimalPlaces: 0 }, 'en-US')).toBe('1,250 SYP');
    expect(roundSypTo50(1276)).toBe(1300);
    expect(roundSypTo50(1251)).toBe(1300);
    expect(roundSypTo50(1250)).toBe(1250);
  });

  it('maps normal and exceptional Doctor-visible order states', () => {
    expect(getOrderStatusLabel('received')).toBe('وصلنا الطلب وعم نحضّره لنبعتلك ياه');
    expect(getOrderStatusLabel('sourcing')).toBe('وصلنا الطلب وعم نحضّره لنبعتلك ياه');
    expect(getOrderStatusLabel('preparing')).toBe('وصلنا الطلب وعم نحضّره لنبعتلك ياه');
    expect(getOrderStatusLabel('ready_for_delivery')).toBe('وصلنا الطلب وعم نحضّره لنبعتلك ياه');
    expect(getOrderStatusLabel('out_for_delivery')).toBe('عم نوصّله');
    expect(getOrderStatusLabel('delivered')).toBe('وصل');
    expect(getOrderStatusLabel('problem')).toBe('مشكلة بالطلب');
  });

  it('collapses internal fulfilment states into three tracking steps', () => {
    expect(getOrderTrackingStep('received')).toBe(0);
    expect(getOrderTrackingStep('sourcing')).toBe(0);
    expect(getOrderTrackingStep('preparing')).toBe(0);
    expect(getOrderTrackingStep('ready_for_delivery')).toBe(0);
    expect(getOrderTrackingStep('out_for_delivery')).toBe(1);
    expect(getOrderTrackingStep('delivered')).toBe(2);
  });

  it('normalizes network and session errors to safe Arabic messages', () => {
    expect(normalizeAppError(new Error('Failed to fetch')).kind).toBe('network');
    expect(normalizeAppError(new Error('JWT expired')).kind).toBe('unauthorized');
    expect(normalizeAppError(new Error('Invalid login credentials')).messageAr).toContain('البريد أو كلمة السر غير صحيحة');
    expect(normalizeAppError(new Error('Invalid Refresh Token: Refresh Token Not Found')).kind).toBe('unauthorized');
  });

  it('rejects negative quantities and fractional minor units', () => {
    expect(() => calculateSubtotal([{ quantity: -1, unitPriceMinor: 100 }])).toThrow('Invalid cart line');
    expect(() => calculateSubtotal([{ quantity: 1, unitPriceMinor: 10.5 }])).toThrow('Invalid cart line');
  });
});
