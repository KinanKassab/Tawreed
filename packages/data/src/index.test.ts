import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signUp: vi.fn(),
  rpc: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      signUp: mocks.signUp,
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    },
    rpc: mocks.rpc,
    storage: { from: vi.fn(() => ({ getPublicUrl: mocks.getPublicUrl })) },
    from: vi.fn(),
  })),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AppState: { addEventListener: vi.fn() },
}));

import { createTawreedDataLayer } from './index';

const config = {
  supabaseUrl: 'https://example.supabase.co',
  supabasePublishableKey: 'public-key-long-enough',
  mediaPublicBaseUrl: 'https://media.example.com/base/',
};

describe('Supabase repository adapter contracts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests WhatsApp OTP without silently creating a second account', async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: null });
    const data = createTawreedDataLayer(config);

    await data.auth.requestWhatsAppOtp('+963900000000', false);

    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      phone: '+963900000000',
      options: { channel: 'whatsapp', shouldCreateUser: false },
    });
  });

  it('reports an active session after password registration', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
    const data = createTawreedDataLayer(config);

    const signedIn = await data.auth.signUpWithPassword('doctor@example.test', 'StrongPassword-123!', 'طبيب اختبار', 'عيادة الاختبار');

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'doctor@example.test',
      password: 'StrongPassword-123!',
      options: { data: { full_name: 'طبيب اختبار', clinic_name: 'عيادة الاختبار' } },
    });
    expect(signedIn).toBe(true);
  });

  it('sends only product identity and quantity to the authoritative checkout RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ order_id: 'order-1', order_number: 'TWD-1001' }], error: null });
    const data = createTawreedDataLayer(config);

    const result = await data.orders.createOrder({
      idempotencyKey: 'request-1',
      displayCurrency: 'USD',
      deliveryAddress: 'دمشق، شارع الاختبار',
      recipientName: 'طبيب الاختبار',
      recipientPhone: '+963900000000',
      items: [{ productId: 'product-1', quantity: 2 }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith('create_doctor_order', expect.objectContaining({
      p_idempotency_key: 'request-1',
      p_items: [{ product_id: 'product-1', quantity: 2 }],
    }));
    expect(JSON.stringify(mocks.rpc.mock.calls[0])).not.toContain('unitPrice');
    expect(result).toEqual({ orderId: 'order-1', orderNumber: 'TWD-1001' });
  });

  it('rejects an incomplete checkout response', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const data = createTawreedDataLayer(config);

    await expect(data.orders.createOrder({
      idempotencyKey: 'request-2', displayCurrency: 'USD', deliveryAddress: 'دمشق، شارع الاختبار',
      recipientName: 'طبيب الاختبار', recipientPhone: '+963900000000', items: [{ productId: 'product-1', quantity: 1 }],
    })).rejects.toThrow('Order creation returned no order');
  });

  it('resolves external, CDN, and Supabase media through one boundary', () => {
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://storage.example.com/product.png' } });
    const data = createTawreedDataLayer(config);
    const common = { id: 'media-1', altTextAr: 'صورة', width: null, height: null };

    expect(data.media.resolve({ ...common, provider: 'external', objectKey: null, externalUrl: 'https://external.example.com/a.png' })).toBe('https://external.example.com/a.png');
    expect(data.media.resolve({ ...common, provider: 'cdn', objectKey: '/catalog/a.png', externalUrl: null })).toBe('https://media.example.com/base/catalog/a.png');
    expect(data.media.resolve({ ...common, provider: 'supabase', objectKey: 'catalog/a.png', externalUrl: null })).toBe('https://storage.example.com/product.png');
  });
});
