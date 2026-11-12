import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn(),
  rpc: vi.fn(),
  getPublicUrl: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: mocks.signUp,
      verifyOtp: mocks.verifyOtp,
      resend: mocks.resend,
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    },
    rpc: mocks.rpc,
    storage: { from: vi.fn(() => ({ getPublicUrl: mocks.getPublicUrl, upload: mocks.upload, remove: mocks.remove })) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })) })) })),
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
  beforeEach(() => {
    vi.clearAllMocks();
    const user = { id: 'doctor-1' };
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'token', user } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { id: user.id }, error: null });
  });

  it('reports an active session after password registration', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
    const data = createTawreedDataLayer(config);

    const signedIn = await data.auth.signUpWithPassword({
      email: 'doctor@example.test',
      password: 'StrongPassword-123!',
      firstName: 'طبيب',
      lastName: 'اختبار',
      phone: '+963900000000',
      preferredContact: 'whatsapp',
      deliveryAddress: 'دمشق، شارع الاختبار',
      latitude: 33.5138,
      longitude: 36.2765,
      googlePlaceId: 'place-1',
    });

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'doctor@example.test',
      password: 'StrongPassword-123!',
      options: { data: {
        first_name: 'طبيب',
        last_name: 'اختبار',
        full_name: 'طبيب اختبار',
        phone: '+963900000000',
        preferred_contact: 'whatsapp',
        default_address: 'دمشق، شارع الاختبار',
        default_latitude: 33.5138,
        default_longitude: 36.2765,
        default_google_place_id: 'place-1',
      } },
    });
    expect(signedIn).toBe(true);
  });

  it('does not show an activation step when signup returns an obfuscated existing user', async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { identities: [] } },
      error: null,
    });
    const data = createTawreedDataLayer(config);

    await expect(data.auth.signUpWithPassword({
      email: 'existing@example.test',
      password: 'StrongPassword-123!',
      firstName: 'طبيب',
      lastName: 'مسجل',
      phone: '+963900000000',
      preferredContact: 'email',
      deliveryAddress: 'دمشق، شارع الاختبار',
      latitude: null,
      longitude: null,
      googlePlaceId: null,
    })).rejects.toThrow('signup_not_created');
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
      bundleIds: [],
    });

    expect(mocks.rpc).toHaveBeenCalledWith('create_doctor_order', expect.objectContaining({
      p_idempotency_key: 'request-1',
      p_items: [{ product_id: 'product-1', quantity: 2 }],
      p_bundle_ids: [],
    }));
    expect(JSON.stringify(mocks.rpc.mock.calls[0])).not.toContain('unitPrice');
    expect(result).toEqual({ orderId: 'order-1', orderNumber: 'TWD-1001' });
  });

  it('clears a deleted or invalid account session before checkout', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, message: 'User not found' } });
    const data = createTawreedDataLayer(config);

    await expect(data.auth.validateSession()).resolves.toEqual({ session: null, invalidated: true });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('rejects an incomplete checkout response', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const data = createTawreedDataLayer(config);

    await expect(data.orders.createOrder({
      idempotencyKey: 'request-2', displayCurrency: 'USD', deliveryAddress: 'دمشق، شارع الاختبار',
      recipientName: 'طبيب الاختبار', recipientPhone: '+963900000000', items: [{ productId: 'product-1', quantity: 1 }], bundleIds: [],
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

  it('uploads a normalized product image before the atomic product update', async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
    const data = createTawreedDataLayer(config);
    const bytes = new ArrayBuffer(16);

    await data.operations.updateProduct({
      productId: '20000000-0000-0000-0000-000000000001',
      nameAr: 'منتج اختبار',
      manufacturer: 'شركة اختبار',
      unitLabelAr: 'قطعة',
      packageLabelAr: 'علبة',
      descriptionAr: 'وصف اختبار',
      specificationsAr: 'مواصفات اختبار',
      availability: 'available',
      lowStockThreshold: 4,
      sellingPriceMinor: 4600,
      costMinor: 2500,
      currency: 'NEW_SYP',
      decimalPlaces: 0,
      onHand: 20,
      inventoryNotes: 'تعديل اختبار',
      image: { bytes, mimeType: 'image/webp', extension: 'webp', width: 1200, height: 1200 },
    });

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/20000000-0000-0000-0000-000000000001\/.+[.]webp$/),
      bytes,
      { cacheControl: '31536000', contentType: 'image/webp', upsert: false },
    );
    expect(mocks.rpc).toHaveBeenCalledWith('operations_update_product', expect.objectContaining({
      p_product_id: '20000000-0000-0000-0000-000000000001',
      p_sell_price_minor: 4600,
      p_cost_minor: 2500,
      p_image_width: 1200,
      p_image_height: 1200,
    }));
  });

  it('searches through the ranked catalog RPC, forwards cancellation, and skips the detail query when nothing matches', async () => {
    const result = { data: [], error: null };
    const searchRequest = {
      abortSignal: vi.fn(() => searchRequest),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    mocks.rpc.mockReturnValue(searchRequest);
    const data = createTawreedDataLayer(config);
    const controller = new AbortController();

    const products = await data.catalog.listProducts({ query: '  جوتا  ', categoryId: 'category-1', signal: controller.signal });

    expect(mocks.rpc).toHaveBeenCalledWith('search_catalog_products', {
      p_query: 'جوتا',
      p_category_id: 'category-1',
      p_availability: null,
      p_limit: 120,
    });
    expect(searchRequest.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(products).toEqual([]);
  });

  it('surfaces catalog search RPC errors', async () => {
    const result = { data: null, error: new Error('search failed') };
    const searchRequest = {
      abortSignal: vi.fn(() => searchRequest),
      then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
    };
    mocks.rpc.mockReturnValue(searchRequest);
    const data = createTawreedDataLayer(config);

    await expect(data.catalog.listProducts({ query: 'rubber' })).rejects.toThrow('search failed');
  });

  it('ranks Operations products through the same search RPC, archived products included', async () => {
    const result = { data: [{ product_id: 'p-1', search_rank: 90 }, { product_id: 'p-2', search_rank: 30 }], error: null };
    const searchRequest = {
      abortSignal: vi.fn(() => searchRequest),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    mocks.rpc.mockReturnValue(searchRequest);
    const data = createTawreedDataLayer(config);
    const controller = new AbortController();

    const ranks = await data.operations.searchProductRanks(' تبطن ', controller.signal);

    expect(mocks.rpc).toHaveBeenCalledWith('search_catalog_products', { p_query: 'تبطن', p_limit: 1000, p_include_inactive: true });
    expect(searchRequest.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect([...ranks]).toEqual([['p-1', 90], ['p-2', 30]]);
  });

  it('sends a product request with only the product name and search text', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const data = createTawreedDataLayer(config);

    await data.catalog.requestProduct({ productName: '  سماعة طبية ', searchQuery: ' سماعه ' });

    expect(mocks.rpc).toHaveBeenCalledWith('request_catalog_product', { p_product_name: 'سماعة طبية', p_search_query: 'سماعه' });
  });

  it('surfaces product request errors', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('PRODUCT_NAME_INVALID') });
    const data = createTawreedDataLayer(config);

    await expect(data.catalog.requestProduct({ productName: 'x' })).rejects.toThrow('PRODUCT_NAME_INVALID');
  });
});
