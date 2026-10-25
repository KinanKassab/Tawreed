import { describe, expect, it } from 'vitest';
import { checkoutSchema, emailPasswordSchema, otpSchema, phoneSchema, profileSchema } from './index';

describe('Doctor input validation', () => {
  it('accepts a valid email/password and rejects a short password', () => {
    expect(emailPasswordSchema.safeParse({ email: 'doctor@example.com', password: 'safe-pass-123' }).success).toBe(true);
    expect(emailPasswordSchema.safeParse({ email: 'doctor@example.com', password: 'short' }).success).toBe(false);
  });

  it('requires international phone format and a six-digit OTP', () => {
    expect(phoneSchema.safeParse({ phone: '+963900000000' }).success).toBe(true);
    expect(phoneSchema.safeParse({ phone: '0900000000' }).success).toBe(false);
    expect(otpSchema.safeParse({ phone: '+963900000000', token: '123456' }).success).toBe(true);
    expect(otpSchema.safeParse({ phone: '+963900000000', token: '12345a' }).success).toBe(false);
  });

  it('requires a usable default address in profile updates', () => {
    expect(profileSchema.safeParse({ fullName: 'طبيب الاختبار', clinicName: null, defaultAddress: 'دمشق، شارع الاختبار' }).success).toBe(true);
    expect(profileSchema.safeParse({ fullName: 'ط', clinicName: null, defaultAddress: 'قصير' }).success).toBe(false);
  });

  it('blocks checkout until terms and complete delivery details are provided', () => {
    const valid = { recipientName: 'طبيب الاختبار', recipientPhone: '+963900000000', deliveryAddress: 'دمشق، شارع الاختبار', deliveryNotes: '', acceptedTerms: true };
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...valid, acceptedTerms: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, deliveryAddress: 'قصير' }).success).toBe(false);
  });
});
