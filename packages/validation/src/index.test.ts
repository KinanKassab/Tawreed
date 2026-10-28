import { describe, expect, it } from 'vitest';
import { checkoutSchema, emailPasswordSchema, profileSchema, registerSchema } from './index';

describe('Doctor input validation', () => {
  it('accepts a valid email/password and rejects a short password', () => {
    expect(emailPasswordSchema.safeParse({ email: 'doctor@example.com', password: 'safe-pass-123' }).success).toBe(true);
    expect(emailPasswordSchema.safeParse({ email: 'doctor@example.com', password: 'short' }).success).toBe(false);
  });

  it('keeps the phone number as registration contact data only', () => {
    const valid = {
      email: 'doctor@example.com', password: 'safe-pass-123', firstName: 'طبيب', lastName: 'اختبار',
      phone: '+963900000000', preferredContact: 'phone', deliveryAddress: 'دمشق، شارع الاختبار',
      latitude: null, longitude: null, googlePlaceId: null,
    };
    expect(registerSchema.safeParse(valid).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, phone: '0900000000' }).success).toBe(false);
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
