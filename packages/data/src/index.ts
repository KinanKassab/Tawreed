import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { ClientConfig } from '@tawreed/config';
import type {
  Category,
  CurrencyCode,
  DoctorProfile,
  MediaAsset,
  OrderDetail,
  OrderSummary,
  Product,
} from '@tawreed/domain';

export interface AuthRepository {
  getSession(): Promise<Session | null>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUpWithPassword(email: string, password: string, fullName: string, clinicName?: string): Promise<boolean>;
  requestWhatsAppOtp(phone: string, shouldCreateUser: boolean): Promise<void>;
  verifyPhoneOtp(phone: string, token: string): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface CatalogFilters {
  query?: string;
  categoryId?: string;
  availability?: Product['availability'][];
  limit?: number;
  offset?: number;
}

export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listProducts(filters?: CatalogFilters): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
}

export interface ProfileRepository {
  getMine(): Promise<DoctorProfile | null>;
  updateMine(input: Pick<DoctorProfile, 'fullName' | 'clinicName' | 'defaultAddress'>): Promise<void>;
}

export interface OrdersRepository {
  listMine(): Promise<OrderSummary[]>;
  getMineById(id: string): Promise<OrderDetail | null>;
  createOrder(input: {
    idempotencyKey: string;
    displayCurrency: CurrencyCode;
    deliveryAddress: string;
    recipientName: string;
    recipientPhone: string;
    deliveryNotes?: string;
    items: { productId: string; quantity: number }[];
  }): Promise<{ orderId: string; orderNumber: string }>;
}

export interface SupportRepository {
  createCase(subject: string, message: string): Promise<{ id: string }>;
}

export interface MediaRepository {
  resolve(asset: MediaAsset | null): string | null;
}

export interface TawreedDataLayer {
  client: SupabaseClient;
  auth: AuthRepository;
  catalog: CatalogRepository;
  profile: ProfileRepository;
  orders: OrdersRepository;
  support: SupportRepository;
  media: MediaRepository;
}

interface CatalogProductRow {
  id: string;
  sku: string;
  name_ar: string;
  name_en: string | null;
  manufacturer: string | null;
  unit_label_ar: string;
  package_label_ar: string | null;
  description_ar: string | null;
  specifications_ar: string | null;
  availability: Product['availability'];
  categories: { id: string; slug: string; name_ar: string; name_en: string | null } | null;
  product_prices: { amount_minor: number; currency: CurrencyCode; decimal_places: number }[] | null;
  product_media: { media_assets: {
    id: string;
    provider: MediaAsset['provider'];
    object_key: string | null;
    external_url: string | null;
    alt_text_ar: string | null;
    width: number | null;
    height: number | null;
  } | null }[] | null;
}

function mapProduct(row: CatalogProductRow): Product {
  const price = row.product_prices?.[0];
  if (!row.categories) throw new Error('Incomplete catalog product');
  const mediaRow = row.product_media?.[0]?.media_assets;
  return {
    id: row.id,
    sku: row.sku,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    manufacturer: row.manufacturer,
    unitLabelAr: row.unit_label_ar,
    packageLabelAr: row.package_label_ar,
    descriptionAr: row.description_ar,
    specificationsAr: row.specifications_ar,
    availability: row.availability,
    category: { id: row.categories.id, slug: row.categories.slug, nameAr: row.categories.name_ar, nameEn: row.categories.name_en },
    price: price ? { amountMinor: price.amount_minor, currency: price.currency, decimalPlaces: price.decimal_places } : null,
    media: mediaRow ? {
      id: mediaRow.id,
      provider: mediaRow.provider,
      objectKey: mediaRow.object_key,
      externalUrl: mediaRow.external_url,
      altTextAr: mediaRow.alt_text_ar ?? row.name_ar,
      width: mediaRow.width,
      height: mediaRow.height,
    } : null,
  };
}

export function createTawreedDataLayer(config: ClientConfig): TawreedDataLayer {
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });

  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }

  const media: MediaRepository = {
    resolve(asset) {
      if (!asset) return null;
      if (asset.provider === 'external') return asset.externalUrl;
      if (asset.provider === 'cdn' && config.mediaPublicBaseUrl && asset.objectKey) {
        return `${config.mediaPublicBaseUrl.replace(/\/$/, '')}/${asset.objectKey.replace(/^\//, '')}`;
      }
      if (asset.provider === 'supabase' && asset.objectKey) {
        return client.storage.from('product-media').getPublicUrl(asset.objectKey).data.publicUrl;
      }
      return null;
    },
  };

  const productSelect = `
    id, sku, name_ar, name_en, manufacturer, unit_label_ar, package_label_ar, description_ar,
    specifications_ar, availability,
    categories!inner(id, slug, name_ar, name_en),
    product_prices(amount_minor, currency, decimal_places),
    product_media(media_assets(id, provider, object_key, external_url, alt_text_ar, width, height))
  `;

  const catalog: CatalogRepository = {
    async listCategories() {
      const { data, error } = await client.from('categories').select('id, slug, name_ar, name_en').eq('active', true).order('sort_order');
      if (error) throw error;
      return (data ?? []).map((row) => ({ id: row.id, slug: row.slug, nameAr: row.name_ar, nameEn: row.name_en }));
    },
    async listProducts(filters = {}) {
      let query = client.from('products').select(productSelect).eq('active', true).eq('product_prices.active', true);
      if (filters.query) query = query.ilike('search_text', `%${filters.query}%`);
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.availability?.length) query = query.in('availability', filters.availability);
      const offset = filters.offset ?? 0;
      query = query.range(offset, offset + (filters.limit ?? 30) - 1).order('name_ar');
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as CatalogProductRow[]).map(mapProduct);
    },
    async getProduct(id) {
      const { data, error } = await client.from('products').select(productSelect).eq('id', id).eq('active', true).eq('product_prices.active', true).maybeSingle();
      if (error) throw error;
      return data ? mapProduct(data as unknown as CatalogProductRow) : null;
    },
  };

  return {
    client,
    media,
    catalog,
    auth: {
      async getSession() {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session;
      },
      async signInWithPassword(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUpWithPassword(email, password, fullName, clinicName) {
        const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName, clinic_name: clinicName ?? null } } });
        if (error) throw error;
        return Boolean(data.session);
      },
      async requestWhatsAppOtp(phone, shouldCreateUser) {
        const { error } = await client.auth.signInWithOtp({ phone, options: { channel: 'whatsapp', shouldCreateUser } });
        if (error) throw error;
      },
      async verifyPhoneOtp(phone, token) {
        const { error } = await client.auth.verifyOtp({ phone, token, type: 'sms' });
        if (error) throw error;
      },
      async requestPasswordReset(email, redirectTo) {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
      },
      async updatePassword(password) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
      },
      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },
    },
    profile: {
      async getMine() {
        const { data, error } = await client.from('profiles').select('id, full_name, clinic_name, phone, email, default_address').maybeSingle();
        if (error) throw error;
        return data ? {
          id: data.id,
          fullName: data.full_name,
          clinicName: data.clinic_name,
          phone: data.phone,
          email: data.email,
          defaultAddress: data.default_address,
        } : null;
      },
      async updateMine(input) {
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData.user) throw userError ?? new Error('Unauthorized');
        const { error } = await client.from('profiles').update({
          full_name: input.fullName,
          clinic_name: input.clinicName,
          default_address: input.defaultAddress,
        }).eq('id', userData.user.id);
        if (error) throw error;
      },
    },
    orders: {
      async listMine() {
        const { data, error } = await client.from('orders').select('id, order_number, status, created_at, total_minor, currency, currency_decimal_places, order_items(quantity)').order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map((row) => ({
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          createdAt: row.created_at,
          itemCount: (row.order_items ?? []).reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
          total: { amountMinor: row.total_minor, currency: row.currency, decimalPlaces: row.currency_decimal_places },
        })) as OrderSummary[];
      },
      async getMineById(id) {
        const { data, error } = await client.from('orders').select(`
          id, order_number, status, created_at, total_minor, currency, currency_decimal_places,
          delivery_address_snapshot, recipient_name_snapshot, recipient_phone_snapshot, delivery_notes,
          order_items(id, product_id, sku_snapshot, name_ar_snapshot, unit_label_ar_snapshot, package_label_ar_snapshot, quantity, unit_price_minor, line_total_minor, currency, currency_decimal_places),
          order_status_history(id, status, doctor_message_ar, created_at)
        `).eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return null;
        const row = data as unknown as {
          id: string; order_number: string; status: OrderSummary['status']; created_at: string; total_minor: number; currency: CurrencyCode; currency_decimal_places: number;
          delivery_address_snapshot: string; recipient_name_snapshot: string; recipient_phone_snapshot: string; delivery_notes: string | null;
          order_items: { id: string; product_id: string | null; sku_snapshot: string; name_ar_snapshot: string; unit_label_ar_snapshot: string; package_label_ar_snapshot: string | null; quantity: number; unit_price_minor: number; line_total_minor: number; currency: CurrencyCode; currency_decimal_places: number }[];
          order_status_history: { id: string; status: OrderSummary['status']; doctor_message_ar: string | null; created_at: string }[];
        };
        return {
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          createdAt: row.created_at,
          itemCount: row.order_items.reduce((sum, item) => sum + item.quantity, 0),
          total: { amountMinor: row.total_minor, currency: row.currency, decimalPlaces: row.currency_decimal_places },
          deliveryAddress: row.delivery_address_snapshot,
          recipientName: row.recipient_name_snapshot,
          recipientPhone: row.recipient_phone_snapshot,
          deliveryNotes: row.delivery_notes,
          items: row.order_items.map((item) => ({ id: item.id, productId: item.product_id, sku: item.sku_snapshot, nameAr: item.name_ar_snapshot, unitLabelAr: item.unit_label_ar_snapshot, packageLabelAr: item.package_label_ar_snapshot, quantity: item.quantity, unitPrice: { amountMinor: item.unit_price_minor, currency: item.currency, decimalPlaces: item.currency_decimal_places }, lineTotal: { amountMinor: item.line_total_minor, currency: item.currency, decimalPlaces: item.currency_decimal_places } })),
          history: row.order_status_history.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((entry) => ({ id: entry.id, status: entry.status, messageAr: entry.doctor_message_ar, createdAt: entry.created_at })),
        };
      },
      async createOrder(input) {
        const { data, error } = await client.rpc('create_doctor_order', {
          p_idempotency_key: input.idempotencyKey,
          p_display_currency: input.displayCurrency,
          p_delivery_address: input.deliveryAddress,
          p_recipient_name: input.recipientName,
          p_recipient_phone: input.recipientPhone,
          p_delivery_notes: input.deliveryNotes ?? null,
          p_items: input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
        });
        if (error) throw error;
        const result = Array.isArray(data) ? data[0] : data;
        if (!result?.order_id || !result?.order_number) throw new Error('Order creation returned no order');
        return { orderId: result.order_id, orderNumber: result.order_number };
      },
    },
    support: {
      async createCase(subject, message) {
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData.user) throw userError ?? new Error('Unauthorized');
        const { data: inserted, error } = await client.from('support_cases').insert({ user_id: userData.user.id, subject, message }).select('id').single();
        if (error) throw error;
        return { id: inserted.id };
      },
    },
  };
}
