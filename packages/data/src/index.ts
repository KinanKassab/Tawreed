import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { ClientConfig } from '@tawreed/config';
import type {
  Category,
  CurrencyCode,
  DoctorProfile,
  DoctorOrderStatus,
  MediaAsset,
  OrderDetail,
  OrderSummary,
  OperationsExchangeRate,
  OperationsOrder,
  OperationsProduct,
  Product,
  StaffRank,
} from '@tawreed/domain';

export interface AuthRepository {
  getSession(): Promise<Session | null>;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUpWithPassword(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    preferredContact: 'phone' | 'whatsapp' | 'email';
    deliveryAddress: string;
    latitude: number | null;
    longitude: number | null;
    googlePlaceId: string | null;
  }): Promise<boolean>;
  verifySignupCode(email: string, token: string): Promise<void>;
  resendSignupCode(email: string): Promise<void>;
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
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
    deliveryGooglePlaceId?: string | null;
    items: { productId: string; quantity: number }[];
  }): Promise<{ orderId: string; orderNumber: string }>;
}

export interface SupportRepository {
  createCase(subject: string, message: string): Promise<{ id: string }>;
}

export interface MediaRepository {
  resolve(asset: MediaAsset | null): string | null;
}

export interface OperationsRepository {
  getMyContext(): Promise<{ userId: string; rank: StaffRank } | null>;
  listOrders(): Promise<OperationsOrder[]>;
  listProducts(query?: string): Promise<OperationsProduct[]>;
  getActiveExchangeRate(): Promise<OperationsExchangeRate | null>;
  setProductPrice(input: { productId: string; amountMinor: number; currency: CurrencyCode; decimalPlaces: number }): Promise<void>;
  setExchangeRate(input: { baseCurrency: CurrencyCode; quoteCurrency: CurrencyCode; rate: number }): Promise<void>;
  adjustInventory(input: { productId: string; quantityDelta: number; notes: string }): Promise<void>;
  setProductAvailability(productId: string, availability: Product['availability']): Promise<void>;
  updateProduct(input: {
    productId: string;
    nameAr: string;
    descriptionAr: string;
    availability: Product['availability'];
    lowStockThreshold: number;
    sellingPriceMinor: number | null;
    costMinor: number | null;
    currency: CurrencyCode;
    decimalPlaces: number;
    onHand: number;
    inventoryNotes: string;
    image?: {
      bytes: ArrayBuffer;
      mimeType: 'image/webp' | 'image/png' | 'image/jpeg';
      extension: 'webp' | 'png' | 'jpg';
      width: number;
      height: number;
    };
  }): Promise<void>;
  confirmOrder(orderId: string, doctorMessageAr?: string): Promise<DoctorOrderStatus>;
  setOrderStatus(orderId: string, status: DoctorOrderStatus, doctorMessageAr?: string): Promise<DoctorOrderStatus>;
}

export interface TawreedDataLayer {
  client: SupabaseClient;
  auth: AuthRepository;
  catalog: CatalogRepository;
  profile: ProfileRepository;
  orders: OrdersRepository;
  support: SupportRepository;
  media: MediaRepository;
  operations: OperationsRepository;
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

  const operations: OperationsRepository = {
    async getMyContext() {
      const { data, error } = await client.rpc('operations_get_my_context');
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { user_id?: string; rank?: StaffRank } | null;
      return row?.user_id && row.rank ? { userId: row.user_id, rank: row.rank } : null;
    },
    async listOrders() {
      const { data, error } = await client.from('orders').select(`
        id, order_number, status, created_at, recipient_name_snapshot, recipient_phone_snapshot,
        delivery_address_snapshot, total_minor, currency, currency_decimal_places, order_items(quantity)
      `).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        status: row.status,
        createdAt: row.created_at,
        recipientName: row.recipient_name_snapshot,
        recipientPhone: row.recipient_phone_snapshot,
        deliveryAddress: row.delivery_address_snapshot,
        itemCount: (row.order_items ?? []).reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
        total: { amountMinor: row.total_minor, currency: row.currency, decimalPlaces: row.currency_decimal_places },
      })) as OperationsOrder[];
    },
    async listProducts(queryText) {
      let query = client.from('products').select(`
        id, sku, name_ar, description_ar, availability, active, low_stock_threshold,
        product_prices(amount_minor, currency, decimal_places, active),
        product_costs(amount_minor, currency, decimal_places, active),
        inventory_balances(on_hand, reserved),
        product_media(is_primary, media_assets(id, provider, object_key, external_url, alt_text_ar, width, height))
      `).order('name_ar').limit(200);
      if (queryText?.trim()) query = query.ilike('search_text', `%${queryText.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => {
        const price = (row.product_prices ?? []).find((candidate: { active: boolean }) => candidate.active);
        const cost = (row.product_costs ?? []).find((candidate: { active: boolean }) => candidate.active);
        const balance = row.inventory_balances?.[0];
        const mediaLink = (row.product_media ?? []).find((candidate: { is_primary: boolean }) => candidate.is_primary) ?? row.product_media?.[0];
        const mediaValue = mediaLink?.media_assets;
        const mediaRow = Array.isArray(mediaValue) ? mediaValue[0] : mediaValue;
        return {
          id: row.id,
          sku: row.sku,
          nameAr: row.name_ar,
          descriptionAr: row.description_ar,
          availability: row.availability,
          active: row.active,
          price: price ? { amountMinor: price.amount_minor, currency: price.currency, decimalPlaces: price.decimal_places } : null,
          cost: cost ? { amountMinor: cost.amount_minor, currency: cost.currency, decimalPlaces: cost.decimal_places } : null,
          media: mediaRow ? {
            id: mediaRow.id,
            provider: mediaRow.provider,
            objectKey: mediaRow.object_key,
            externalUrl: mediaRow.external_url,
            altTextAr: mediaRow.alt_text_ar ?? row.name_ar,
            width: mediaRow.width,
            height: mediaRow.height,
          } : null,
          onHand: balance?.on_hand ?? 0,
          reserved: balance?.reserved ?? 0,
          lowStockThreshold: row.low_stock_threshold,
        };
      }) as OperationsProduct[];
    },
    async getActiveExchangeRate() {
      const { data, error } = await client.from('exchange_rates').select('id, base_currency, quote_currency, rate, effective_at').eq('active', true).order('effective_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, baseCurrency: data.base_currency, quoteCurrency: data.quote_currency, rate: Number(data.rate), effectiveAt: data.effective_at } as OperationsExchangeRate : null;
    },
    async setProductPrice(input) {
      const { error } = await client.rpc('operations_set_product_price', {
        p_product_id: input.productId,
        p_amount_minor: input.amountMinor,
        p_currency: input.currency,
        p_decimal_places: input.decimalPlaces,
      });
      if (error) throw error;
    },
    async setExchangeRate(input) {
      const { error } = await client.rpc('operations_set_exchange_rate', {
        p_base_currency: input.baseCurrency,
        p_quote_currency: input.quoteCurrency,
        p_rate: input.rate,
      });
      if (error) throw error;
    },
    async adjustInventory(input) {
      const { error } = await client.rpc('operations_adjust_inventory', {
        p_product_id: input.productId,
        p_quantity_delta: input.quantityDelta,
        p_notes: input.notes,
      });
      if (error) throw error;
    },
    async setProductAvailability(productId, availability) {
      const { data: updated, error } = await client.from('products').update({ availability }).eq('id', productId).select('id').maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error('PRODUCT_NOT_FOUND_OR_FORBIDDEN');
    },
    async updateProduct(input) {
      const objectKey = input.image
        ? `products/${input.productId}/${crypto.randomUUID()}.${input.image.extension}`
        : null;
      if (input.image && objectKey) {
        const { error: uploadError } = await client.storage.from('product-media').upload(objectKey, input.image.bytes, {
          cacheControl: '31536000',
          contentType: input.image.mimeType,
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }
      const { error } = await client.rpc('operations_update_product', {
        p_product_id: input.productId,
        p_name_ar: input.nameAr,
        p_description_ar: input.descriptionAr,
        p_availability: input.availability,
        p_low_stock_threshold: input.lowStockThreshold,
        p_sell_price_minor: input.sellingPriceMinor,
        p_cost_minor: input.costMinor,
        p_currency: input.currency,
        p_decimal_places: input.decimalPlaces,
        p_on_hand: input.onHand,
        p_inventory_notes: input.inventoryNotes,
        p_image_object_key: objectKey,
        p_image_mime_type: input.image?.mimeType ?? null,
        p_image_width: input.image?.width ?? null,
        p_image_height: input.image?.height ?? null,
      });
      if (error) {
        if (objectKey) await client.storage.from('product-media').remove([objectKey]);
        throw error;
      }
    },
    async confirmOrder(orderId, doctorMessageAr) {
      const { data, error } = await client.rpc('operations_confirm_order', { p_order_id: orderId, p_doctor_message_ar: doctorMessageAr ?? null });
      if (error) throw error;
      return data as DoctorOrderStatus;
    },
    async setOrderStatus(orderId, status, doctorMessageAr) {
      const { data, error } = await client.rpc('operations_set_order_status', { p_order_id: orderId, p_status: status, p_doctor_message_ar: doctorMessageAr ?? null });
      if (error) throw error;
      return data as DoctorOrderStatus;
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
      async signUpWithPassword(input) {
        const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`;
        const { data, error } = await client.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: {
              first_name: input.firstName.trim(),
              last_name: input.lastName.trim(),
              full_name: fullName,
              phone: input.phone,
              preferred_contact: input.preferredContact,
              default_address: input.deliveryAddress.trim(),
              default_latitude: input.latitude,
              default_longitude: input.longitude,
              default_google_place_id: input.googlePlaceId,
            },
          },
        });
        if (error) throw error;
        return Boolean(data.session);
      },
      async verifySignupCode(email, token) {
        const { error } = await client.auth.verifyOtp({ email, token, type: 'signup' });
        if (error) throw error;
      },
      async resendSignupCode(email) {
        const { error } = await client.auth.resend({ email, type: 'signup' });
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
        const { data, error } = await client.from('profiles').select('id, first_name, last_name, full_name, clinic_name, phone, email, preferred_contact, default_address, default_latitude, default_longitude, default_google_place_id').maybeSingle();
        if (error) throw error;
        return data ? {
          id: data.id,
          firstName: data.first_name,
          lastName: data.last_name,
          fullName: data.full_name,
          clinicName: data.clinic_name,
          phone: data.phone,
          email: data.email,
          preferredContact: data.preferred_contact,
          defaultAddress: data.default_address,
          defaultLatitude: data.default_latitude,
          defaultLongitude: data.default_longitude,
          defaultGooglePlaceId: data.default_google_place_id,
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
          p_delivery_latitude: input.deliveryLatitude ?? null,
          p_delivery_longitude: input.deliveryLongitude ?? null,
          p_delivery_google_place_id: input.deliveryGooglePlaceId ?? null,
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
        const { error: emailError } = await client.functions.invoke('send-support-email', { body: { caseId: inserted.id } });
        if (emailError) throw emailError;
        return { id: inserted.id };
      },
    },
    operations,
  };
}
