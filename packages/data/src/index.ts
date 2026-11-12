import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { ClientConfig } from '@tawreed/config';
import type {
  BundleItem,
  Category,
  CurrencyCode,
  DoctorProfile,
  DoctorOrderStatus,
  MediaAsset,
  OrderDetail,
  OrderSummary,
  OperationsExchangeRate,
  OperationsOrder,
  OperationsOrderDetail,
  OperationsProduct,
  OperationsPromoBanner,
  Product,
  PromoBanner,
  StaffRank,
} from '@tawreed/domain';

export interface AuthRepository {
  getSession(): Promise<Session | null>;
  validateSession(): Promise<{ session: Session | null; invalidated: boolean }>;
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
  exchangeCodeForSession(code: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
}

const SEARCH_RESULT_LIMIT = 120;

export interface CatalogFilters {
  query?: string;
  categoryId?: string;
  availability?: Product['availability'][];
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listProducts(filters?: CatalogFilters): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  listBanners(): Promise<PromoBanner[]>;
  /** Asks the team to stock a product. Anonymous: only the product name and the search text are stored. */
  requestProduct(input: { productName: string; searchQuery?: string }): Promise<void>;
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
    bundleIds: string[];
  }): Promise<{ orderId: string; orderNumber: string }>;
}

export interface SupportRepository {
  createCase(subject: string, message: string): Promise<{ id: string }>;
}

export interface MediaRepository {
  resolve(asset: MediaAsset | null): string | null;
}

export interface ProductImageUpload {
  bytes: ArrayBuffer;
  mimeType: 'image/webp' | 'image/png' | 'image/jpeg';
  extension: 'webp' | 'png' | 'jpg';
  width: number;
  height: number;
}

export interface OperationsRepository {
  getMyContext(): Promise<{ userId: string; rank: StaffRank } | null>;
  listOrders(): Promise<OperationsOrder[]>;
  getOrderById(id: string): Promise<OperationsOrderDetail | null>;
  listProducts(query?: string): Promise<OperationsProduct[]>;
  getActiveExchangeRate(): Promise<OperationsExchangeRate | null>;
  setProductPrice(input: { productId: string; amountMinor: number; currency: CurrencyCode; decimalPlaces: number }): Promise<void>;
  setExchangeRate(input: { baseCurrency: CurrencyCode; quoteCurrency: CurrencyCode; rate: number }): Promise<void>;
  adjustInventory(input: { productId: string; quantityDelta: number; notes: string }): Promise<void>;
  setProductAvailability(productId: string, availability: Product['availability']): Promise<void>;
  setProductPriceOnRequest(productId: string, priceOnRequest: boolean): Promise<void>;
  updateProduct(input: {
    productId: string;
    nameAr: string;
    manufacturer: string;
    unitLabelAr: string;
    packageLabelAr: string;
    descriptionAr: string;
    specificationsAr: string;
    availability: Product['availability'];
    lowStockThreshold: number;
    sellingPriceMinor: number | null;
    costMinor: number | null;
    currency: CurrencyCode;
    decimalPlaces: number;
    onHand: number;
    inventoryNotes: string;
    image?: ProductImageUpload;
  }): Promise<void>;
  /** Creates a standalone product without price or stock; it stays hidden from Doctors until priced. */
  createProduct(input: { categoryId: string; nameAr: string; unitLabelAr: string }): Promise<string>;
  /** Adds an option next to a product; a standalone source becomes the first option and needs sourceLabelAr. */
  addProductOption(input: { sourceProductId: string; labelAr: string; sourceLabelAr?: string }): Promise<string>;
  /** Renames an option, moves it to another group, or detaches it when groupKey is null. */
  setProductOption(input: { productId: string; groupKey: string | null; labelAr: string | null }): Promise<void>;
  reorderProductOptions(groupKey: string, productIds: string[]): Promise<void>;
  updateGroupDetails(input: { groupKey: string; nameAr: string; manufacturer: string; descriptionAr: string; specificationsAr: string; categoryId: string }): Promise<void>;
  setProductActive(productId: string, active: boolean): Promise<void>;
  /** Archives a standalone product or every option in a group atomically. */
  archiveProducts(productIds: string[]): Promise<number>;
  /** Sets the sales unit of several products (e.g. every option of a group); returns how many changed. */
  setUnitLabel(productIds: string[], unitLabelAr: string): Promise<number>;
  /** Moves products (e.g. every option of a group) to a category; returns how many changed. */
  setProductCategory(productIds: string[], categoryId: string): Promise<number>;
  /** Sets the same USD selling price on several products (e.g. every option of a group); returns how many changed. */
  setPriceForOptions(productIds: string[], usdAmountMinor: number): Promise<number>;
  addProductImage(productId: string, image: ProductImageUpload, makePrimary: boolean): Promise<string>;
  setPrimaryProductImage(productId: string, mediaAssetId: string): Promise<void>;
  reorderProductImages(productId: string, mediaAssetIds: string[]): Promise<void>;
  removeProductImage(productId: string, mediaAssetId: string): Promise<void>;
  /** Replaces the gallery of every other option in the product's group; returns how many options changed. */
  copyProductImagesToGroup(productId: string): Promise<number>;
  confirmOrder(orderId: string, doctorMessageAr?: string): Promise<DoctorOrderStatus>;
  setOrderStatus(orderId: string, status: DoctorOrderStatus, doctorMessageAr?: string): Promise<DoctorOrderStatus>;
  listBanners(): Promise<OperationsPromoBanner[]>;
  createBanner(input: { titleAr: string; linkUrl: string | null; image: ProductImageUpload; offer: BannerOfferInput | null }): Promise<string>;
  /** Leave `offer` undefined to keep the banner's current offer; null removes it. */
  updateBanner(input: { id: string; titleAr: string; linkUrl: string | null; active: boolean; expiresAt: string | null; image?: ProductImageUpload; offer?: BannerOfferInput | null }): Promise<void>;
  reorderBanners(ids: string[]): Promise<void>;
  deleteBanner(id: string): Promise<void>;
}

export interface BannerOfferInput {
  items: BundleItem[];
  priceUsdMinor: number;
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
  price_on_request: boolean;
  variant_group_key: string | null;
  variant_label_ar: string | null;
  variant_sort_order: number;
  categories: { id: string; slug: string; name_ar: string; name_en: string | null } | null;
  product_prices: { amount_minor: number; currency: CurrencyCode; decimal_places: number }[] | null;
  product_media: { is_primary: boolean; sort_order: number; media_assets: {
    id: string;
    provider: MediaAsset['provider'];
    object_key: string | null;
    external_url: string | null;
    alt_text_ar: string | null;
    width: number | null;
    height: number | null;
  } | null }[] | null;
}

// Primary image first, then gallery order; the Doctor app shows the first one.
const primaryMediaLink = <T extends { is_primary: boolean; sort_order: number }>(links: T[] | null | undefined) =>
  [...(links ?? [])].sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.sort_order - right.sort_order)[0];

const displayPrice = (row: CatalogProductRow) => row.product_prices?.find((price) => price.currency === 'NEW_SYP') ?? row.product_prices?.[0];

function mapProductGroup(rows: CatalogProductRow[], selectedId?: string): Product {
  const pricedRows = rows.filter((row) => displayPrice(row));
  const selected = rows.find((row) => row.id === selectedId)
    ?? [...pricedRows].sort((left, right) => (displayPrice(left)?.amount_minor ?? 0) - (displayPrice(right)?.amount_minor ?? 0))[0]
    ?? rows[0];
  if (!selected?.categories) throw new Error('Incomplete catalog product');
  const price = displayPrice(selected);
  const mediaRow = primaryMediaLink(selected.product_media)?.media_assets;
  const mapMedia = (row: CatalogProductRow): MediaAsset | null => {
    const value = primaryMediaLink(row.product_media)?.media_assets;
    return value ? { id: value.id, provider: value.provider, objectKey: value.object_key, externalUrl: value.external_url, altTextAr: value.alt_text_ar ?? row.name_ar, width: value.width, height: value.height } : null;
  };
  return {
    id: selected.id,
    sku: selected.sku,
    nameAr: selected.name_ar,
    nameEn: selected.name_en,
    manufacturer: selected.manufacturer,
    unitLabelAr: selected.unit_label_ar,
    packageLabelAr: selected.package_label_ar,
    descriptionAr: selected.description_ar,
    specificationsAr: selected.specifications_ar,
    availability: selected.availability,
    category: { id: selected.categories.id, slug: selected.categories.slug, nameAr: selected.categories.name_ar, nameEn: selected.categories.name_en },
    price: price ? { amountMinor: price.amount_minor, currency: price.currency, decimalPlaces: price.decimal_places } : null,
    priceOnRequest: selected.price_on_request,
    media: mediaRow ? mapMedia(selected) : null,
    variantLabelAr: selected.variant_label_ar,
    variants: rows
      .filter((row) => row.variant_label_ar)
      .sort((left, right) => left.variant_sort_order - right.variant_sort_order)
      .map((row) => ({
        id: row.id,
        sku: row.sku,
        labelAr: row.variant_label_ar!,
        nameAr: row.name_ar,
        nameEn: row.name_en,
        manufacturer: row.manufacturer,
        unitLabelAr: row.unit_label_ar,
        packageLabelAr: row.package_label_ar,
        descriptionAr: row.description_ar,
        specificationsAr: row.specifications_ar,
        media: mapMedia(row),
        price: displayPrice(row) ? {
          amountMinor: displayPrice(row)!.amount_minor,
          currency: displayPrice(row)!.currency,
          decimalPlaces: displayPrice(row)!.decimal_places,
        } : null,
        priceOnRequest: row.price_on_request,
        availability: row.availability,
      })),
  };
}

export function createTawreedDataLayer(config: ClientConfig): TawreedDataLayer {
  // Static web rendering runs in Node with no localStorage: keep that client sessionless; the browser builds its own.
  const server = Platform.OS === 'web' && typeof window === 'undefined';
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: server ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } : {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });

  const authFailure = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;
    const status = 'status' in error ? Number(error.status) : 0;
    const message = 'message' in error ? String(error.message).toLowerCase() : '';
    return status === 401 || status === 403
      || /invalid.*jwt|jwt.*expired|refresh.*token|session.*(missing|expired|invalid)|user.*not.*found/.test(message);
  };

  const validateSession = async (): Promise<{ session: Session | null; invalidated: boolean }> => {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) return { session: null, invalidated: false };

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user || userData.user.id !== session.user.id) {
      if (!userError || authFailure(userError)) {
        await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
        return { session: null, invalidated: true };
      }
      // Do not destroy an otherwise usable session because the network is briefly unavailable.
      return { session, invalidated: false };
    }

    const { data: profile, error: profileError } = await client.from('profiles').select('id').eq('id', userData.user.id).maybeSingle();
    if (!profileError && !profile) {
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return { session: null, invalidated: true };
    }
    if (profileError && authFailure(profileError)) {
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return { session: null, invalidated: true };
    }
    return { session, invalidated: false };
  };

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

  const bannerPublicUrl = (objectKey: string) => client.storage.from('product-media').getPublicUrl(objectKey).data.publicUrl;
  const mapBundleItems = (value: unknown): BundleItem[] | null => Array.isArray(value)
    ? value.map((item) => ({ productId: String((item as { product_id: string }).product_id), quantity: Number((item as { quantity: number }).quantity) }))
    : null;
  const bannerOffer = (row: { bundle_items: unknown; bundle_price_usd_minor: number | null; bundle_price_syp_minor: number | null }) => ({
    bundleItems: mapBundleItems(row.bundle_items),
    bundlePriceUsd: row.bundle_price_usd_minor === null ? null : { amountMinor: row.bundle_price_usd_minor, currency: 'USD' as const, decimalPlaces: 2 },
    bundlePriceSyp: row.bundle_price_syp_minor === null ? null : { amountMinor: row.bundle_price_syp_minor, currency: 'NEW_SYP' as const, decimalPlaces: 0 },
  });

  const bannerOfferColumns = (offer: BannerOfferInput | null | undefined) => ({
    bundle_items: offer ? offer.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })) : null,
    bundle_price_usd_minor: offer?.priceUsdMinor ?? null,
  });

  const productSelect = `
      id, sku, name_ar, name_en, manufacturer, unit_label_ar, package_label_ar, description_ar,
      specifications_ar, availability, price_on_request, variant_group_key, variant_label_ar, variant_sort_order,
    categories!inner(id, slug, name_ar, name_en),
      product_prices(amount_minor, currency, decimal_places),
    product_media(is_primary, sort_order, media_assets(id, provider, object_key, external_url, alt_text_ar, width, height))
  `;

  const catalog: CatalogRepository = {
    async listCategories() {
      const { data, error } = await client.from('categories').select('id, slug, name_ar, name_en').eq('active', true).order('sort_order');
      if (error) throw error;
      return (data ?? []).map((row) => ({ id: row.id, slug: row.slug, nameAr: row.name_ar, nameEn: row.name_en }));
    },
    async listProducts(filters = {}) {
      const searchQuery = filters.query?.trim();
      let rankedProductIds: string[] | undefined;
      let searchRank = new Map<string, number>();

      if (searchQuery) {
        let searchRequest = client.rpc('search_catalog_products', {
          p_query: searchQuery,
          p_category_id: filters.categoryId ?? null,
          p_availability: filters.availability?.length ? filters.availability : null,
          // Ranked ids are sent back in the URL (`id=in.(...)`), so keep the
          // most relevant matches only to stay well below proxy URL limits.
          p_limit: SEARCH_RESULT_LIMIT,
        });
        if (filters.signal) searchRequest = searchRequest.abortSignal(filters.signal);
        const { data: matches, error: searchError } = await searchRequest;
        if (searchError) throw searchError;
        const rankedMatches = (matches ?? []) as { product_id: string; search_rank: number }[];
        rankedProductIds = rankedMatches.map((match) => match.product_id);
        searchRank = new Map(rankedMatches.map((match) => [match.product_id, Number(match.search_rank)]));
        if (!rankedProductIds.length) return [];
      }

      let query = client.from('products').select(productSelect).eq('active', true).eq('product_prices.active', true).eq('product_prices.currency', 'NEW_SYP');
      if (rankedProductIds) query = query.in('id', rankedProductIds);
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.availability?.length) query = query.in('availability', filters.availability);
      query = query.order('name_ar').limit(1000);
      if (filters.signal) query = query.abortSignal(filters.signal);
      const { data, error } = await query;
      if (error) throw error;
        const grouped = new Map<string, CatalogProductRow[]>();
        for (const row of (data as unknown as CatalogProductRow[]).filter((candidate) => Boolean(displayPrice(candidate)) || candidate.price_on_request)) {
          const key = row.variant_group_key ?? row.id;
          grouped.set(key, [...(grouped.get(key) ?? []), row]);
        }
        const products = [...grouped.values()]
          .map((rows) => ({ product: mapProductGroup(rows), rank: Math.max(...rows.map((row) => searchRank.get(row.id) ?? 0)) }))
          .sort((a, b) => searchQuery ? b.rank - a.rank || a.product.nameAr.localeCompare(b.product.nameAr, 'ar') : a.product.nameAr.localeCompare(b.product.nameAr, 'ar'))
          .map(({ product }) => product);
        const offset = filters.offset ?? 0;
        return products.slice(offset, offset + (filters.limit ?? 30));
    },
    async getProduct(id) {
        const { data, error } = await client.from('products').select(productSelect).eq('id', id).eq('active', true).eq('product_prices.active', true).eq('product_prices.currency', 'NEW_SYP').maybeSingle();
      if (error) throw error;
        if (!data) return null;
        const selected = data as unknown as CatalogProductRow;
        if (!displayPrice(selected) && !selected.price_on_request) return null;
        if (!selected.variant_group_key) return mapProductGroup([selected], id);
        const { data: siblings, error: siblingsError } = await client.from('products').select(productSelect)
          .eq('variant_group_key', selected.variant_group_key).eq('active', true).eq('product_prices.active', true).eq('product_prices.currency', 'NEW_SYP').order('variant_sort_order').order('variant_label_ar');
        if (siblingsError) throw siblingsError;
        const offered = (siblings as unknown as CatalogProductRow[]).filter((candidate) => Boolean(displayPrice(candidate)) || candidate.price_on_request);
        return offered.length ? mapProductGroup(offered, id) : null;
    },
    async listBanners() {
      const { data, error } = await client.from('promo_banners').select('id, title_ar, image_object_key, link_url, bundle_items, bundle_price_usd_minor, bundle_price_syp_minor').order('sort_order');
      if (error) throw error;
      return (data ?? []).map((row) => ({ id: row.id, titleAr: row.title_ar, imageUrl: bannerPublicUrl(row.image_object_key), linkUrl: row.link_url, ...bannerOffer(row) }));
    },
    async requestProduct({ productName, searchQuery }) {
      const { error } = await client.rpc('request_catalog_product', {
        p_product_name: productName.trim(),
        p_search_query: searchQuery?.trim() || null,
      });
      if (error) throw error;
    },
  };

  const uploadProductImage = async (productId: string, image: ProductImageUpload) => {
    const objectKey = `products/${productId}/${crypto.randomUUID()}.${image.extension}`;
    const { error } = await client.storage.from('product-media').upload(objectKey, image.bytes, {
      cacheControl: '31536000',
      contentType: image.mimeType,
      upsert: false,
    });
    if (error) throw error;
    return objectKey;
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
    async getOrderById(id) {
      const { data, error } = await client.from('orders').select(`
        id, order_number, status, created_at, total_minor, currency, currency_decimal_places,
        delivery_address_snapshot, recipient_name_snapshot, recipient_phone_snapshot, delivery_notes,
        order_items(id, product_id, sku_snapshot, name_ar_snapshot, unit_label_ar_snapshot, package_label_ar_snapshot, quantity, unit_price_minor, line_total_minor, currency, currency_decimal_places)
      `).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as {
        id: string; order_number: string; status: OperationsOrder['status']; created_at: string; total_minor: number; currency: CurrencyCode; currency_decimal_places: number;
        delivery_address_snapshot: string; recipient_name_snapshot: string; recipient_phone_snapshot: string; delivery_notes: string | null;
        order_items: { id: string; product_id: string | null; sku_snapshot: string; name_ar_snapshot: string; unit_label_ar_snapshot: string; package_label_ar_snapshot: string | null; quantity: number; unit_price_minor: number; line_total_minor: number; currency: CurrencyCode; currency_decimal_places: number }[];
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
      } as OperationsOrderDetail;
    },
    async listProducts(queryText) {
      const select = `
        id, sku, name_ar, manufacturer, unit_label_ar, package_label_ar, description_ar, specifications_ar, availability, active, price_on_request, low_stock_threshold,
        variant_group_key, variant_label_ar, variant_sort_order,
        categories(id, slug, name_ar, name_en),
        product_prices(amount_minor, currency, decimal_places, active),
        product_costs(amount_minor, currency, decimal_places, active),
        inventory_balances(on_hand, reserved),
        product_media(is_primary, sort_order, media_assets(id, provider, object_key, external_url, alt_text_ar, width, height))
      `;
      const pageSize = 500;
      const fetchAll = async (filter: (query: ReturnType<typeof base>) => ReturnType<typeof base>) => {
        const rows: any[] = [];
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await filter(base()).range(offset, offset + pageSize - 1);
          if (error) throw error;
          rows.push(...(data ?? []));
          if (!data || data.length < pageSize) return rows;
        }
      };
      const base = () => client.from('products').select(select).order('name_ar').order('id');
      const search = queryText?.trim();
      let rows = await fetchAll((query) => search ? query.ilike('search_text', `%${search}%`) : query);
      if (search) {
        // A match on one option brings its whole group so the editor always sees every option.
        const groupKeys = [...new Set(rows.map((row) => row.variant_group_key).filter(Boolean))];
        if (groupKeys.length) {
          const seen = new Set(rows.map((row) => row.id));
          const siblings = await fetchAll((query) => query.in('variant_group_key', groupKeys));
          rows = [...rows, ...siblings.filter((row) => !seen.has(row.id))];
        }
      }
      const mapAsset = (value: any, fallbackAlt: string): MediaAsset => ({
        id: value.id,
        provider: value.provider,
        objectKey: value.object_key,
        externalUrl: value.external_url,
        altTextAr: value.alt_text_ar ?? fallbackAlt,
        width: value.width,
        height: value.height,
      });
      return rows.map((row) => {
        const priceRows = (row.product_prices ?? []).filter((candidate: { active: boolean }) => candidate.active);
        const costRows = (row.product_costs ?? []).filter((candidate: { active: boolean }) => candidate.active);
        const price = priceRows.find((candidate: { currency: CurrencyCode }) => candidate.currency === 'USD') ?? priceRows[0];
        const cost = costRows.find((candidate: { currency: CurrencyCode }) => candidate.currency === 'USD') ?? costRows[0];
        const balance = row.inventory_balances?.[0];
        const gallery = [...(row.product_media ?? [])]
          .map((link: { is_primary: boolean; sort_order: number; media_assets: unknown }) => ({ link, asset: Array.isArray(link.media_assets) ? link.media_assets[0] : link.media_assets }))
          .filter((entry) => entry.asset)
          .sort((left, right) => Number(right.link.is_primary) - Number(left.link.is_primary) || left.link.sort_order - right.link.sort_order)
          .map(({ link, asset }) => ({ ...mapAsset(asset, row.name_ar), isPrimary: link.is_primary, sortOrder: link.sort_order }));
        const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
        return {
          id: row.id,
          sku: row.sku,
          nameAr: row.name_ar,
          manufacturer: row.manufacturer,
          unitLabelAr: row.unit_label_ar,
          packageLabelAr: row.package_label_ar,
          descriptionAr: row.description_ar,
          specificationsAr: row.specifications_ar,
          availability: row.availability,
          active: row.active,
          price: price ? { amountMinor: price.amount_minor, currency: price.currency, decimalPlaces: price.decimal_places } : null,
          priceOnRequest: row.price_on_request,
          cost: cost ? { amountMinor: cost.amount_minor, currency: cost.currency, decimalPlaces: cost.decimal_places } : null,
          media: gallery[0] ?? null,
          gallery,
          category: category ? { id: category.id, slug: category.slug, nameAr: category.name_ar, nameEn: category.name_en } : null,
          variantGroupKey: row.variant_group_key,
          variantLabelAr: row.variant_label_ar,
          variantSortOrder: row.variant_sort_order,
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
    async setProductPriceOnRequest(productId, priceOnRequest) {
      const { error } = await client.rpc('operations_set_price_on_request', {
        p_product_id: productId,
        p_price_on_request: priceOnRequest,
      });
      if (error) throw error;
    },
    async updateProduct(input) {
      const objectKey = input.image ? await uploadProductImage(input.productId, input.image) : null;
      const { error } = await client.rpc('operations_update_product', {
        p_product_id: input.productId,
        p_name_ar: input.nameAr,
        p_manufacturer: input.manufacturer,
        p_unit_label_ar: input.unitLabelAr,
        p_package_label_ar: input.packageLabelAr,
        p_description_ar: input.descriptionAr,
        p_specifications_ar: input.specificationsAr,
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
    async createProduct(input) {
      const { data, error } = await client.rpc('operations_create_product', {
        p_category_id: input.categoryId,
        p_name_ar: input.nameAr,
        p_unit_label_ar: input.unitLabelAr,
      });
      if (error) throw error;
      return data as string;
    },
    async addProductOption(input) {
      const { data, error } = await client.rpc('operations_add_product_option', {
        p_source_product_id: input.sourceProductId,
        p_label_ar: input.labelAr,
        p_source_label_ar: input.sourceLabelAr,
      });
      if (error) throw error;
      return data as string;
    },
    async setProductOption(input) {
      const { error } = await client.rpc('operations_set_product_option', {
        p_product_id: input.productId,
        // Generated RPC types cannot express SQL null for these text arguments.
        p_group_key: input.groupKey as string,
        p_label_ar: input.labelAr as string,
      });
      if (error) throw error;
    },
    async reorderProductOptions(groupKey, productIds) {
      const { error } = await client.rpc('operations_reorder_product_options', { p_group_key: groupKey, p_product_ids: productIds });
      if (error) throw error;
    },
    async updateGroupDetails(input) {
      const { error } = await client.rpc('operations_update_group_details', {
        p_group_key: input.groupKey,
        p_name_ar: input.nameAr,
        p_manufacturer: input.manufacturer,
        p_description_ar: input.descriptionAr,
        p_specifications_ar: input.specificationsAr,
        p_category_id: input.categoryId,
      });
      if (error) throw error;
    },
    async setProductActive(productId, active) {
      const { error } = await client.rpc('operations_set_product_active', { p_product_id: productId, p_active: active });
      if (error) throw error;
    },
    async archiveProducts(productIds) {
      const { data, error } = await client.rpc('operations_archive_products', { p_product_ids: productIds });
      if (error) throw error;
      return data as number;
    },
    async setUnitLabel(productIds, unitLabelAr) {
      const { data, error } = await client.rpc('operations_set_unit_label', { p_product_ids: productIds, p_unit_label_ar: unitLabelAr });
      if (error) throw error;
      return data as number;
    },
    async setProductCategory(productIds, categoryId) {
      const { data, error } = await client.rpc('operations_set_product_category', { p_product_ids: productIds, p_category_id: categoryId });
      if (error) throw error;
      return data as number;
    },
    async setPriceForOptions(productIds, usdAmountMinor) {
      const { data, error } = await client.rpc('operations_set_price_for_options', { p_product_ids: productIds, p_amount_minor: usdAmountMinor });
      if (error) throw error;
      return data as number;
    },
    async addProductImage(productId, image, makePrimary) {
      const objectKey = await uploadProductImage(productId, image);
      const { data, error } = await client.rpc('operations_add_product_image', {
        p_product_id: productId,
        p_object_key: objectKey,
        p_mime_type: image.mimeType,
        p_width: image.width,
        p_height: image.height,
        p_make_primary: makePrimary,
      });
      if (error) {
        await client.storage.from('product-media').remove([objectKey]);
        throw error;
      }
      return data as string;
    },
    async setPrimaryProductImage(productId, mediaAssetId) {
      const { error } = await client.rpc('operations_set_primary_product_image', { p_product_id: productId, p_media_asset_id: mediaAssetId });
      if (error) throw error;
    },
    async reorderProductImages(productId, mediaAssetIds) {
      const { error } = await client.rpc('operations_reorder_product_images', { p_product_id: productId, p_media_asset_ids: mediaAssetIds });
      if (error) throw error;
    },
    async removeProductImage(productId, mediaAssetId) {
      const { error } = await client.rpc('operations_remove_product_image', { p_product_id: productId, p_media_asset_id: mediaAssetId });
      if (error) throw error;
    },
    async copyProductImagesToGroup(productId) {
      const { data, error } = await client.rpc('operations_copy_product_images_to_group', { p_product_id: productId });
      if (error) throw error;
      return data as number;
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
    async listBanners() {
      const { data, error } = await client.from('promo_banners').select('id, title_ar, image_object_key, link_url, bundle_items, bundle_price_usd_minor, bundle_price_syp_minor, sort_order, active, expires_at').order('sort_order');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id, titleAr: row.title_ar, imageUrl: bannerPublicUrl(row.image_object_key), linkUrl: row.link_url, ...bannerOffer(row),
        sortOrder: row.sort_order, active: row.active, expiresAt: row.expires_at,
      }));
    },
    async createBanner({ titleAr, linkUrl, image, offer }) {
      const objectKey = `banners/${crypto.randomUUID()}.${image.extension}`;
      const { error: uploadError } = await client.storage.from('product-media').upload(objectKey, image.bytes, {
        cacheControl: '31536000',
        contentType: image.mimeType,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: lastRow } = await client.from('promo_banners').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await client.from('promo_banners').insert({
        title_ar: titleAr, image_object_key: objectKey, link_url: linkUrl, sort_order: (lastRow?.sort_order ?? -1) + 1, ...bannerOfferColumns(offer),
      }).select('id').single();
      if (error) { await client.storage.from('product-media').remove([objectKey]); throw error; }
      return data.id;
    },
    async updateBanner({ id, titleAr, linkUrl, active, expiresAt, image, offer }) {
      let objectKey: string | undefined;
      if (image) {
        objectKey = `banners/${crypto.randomUUID()}.${image.extension}`;
        const { error: uploadError } = await client.storage.from('product-media').upload(objectKey, image.bytes, {
          cacheControl: '31536000',
          contentType: image.mimeType,
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }
      const { data: previous, error: fetchError } = await client.from('promo_banners').select('image_object_key').eq('id', id).single();
      if (fetchError) { if (objectKey) await client.storage.from('product-media').remove([objectKey]); throw fetchError; }
      const { error } = await client.from('promo_banners').update({
        title_ar: titleAr, link_url: linkUrl, active, expires_at: expiresAt,
        ...(objectKey ? { image_object_key: objectKey } : {}),
        ...(offer !== undefined ? bannerOfferColumns(offer) : {}),
      }).eq('id', id);
      if (error) { if (objectKey) await client.storage.from('product-media').remove([objectKey]); throw error; }
      if (objectKey) await client.storage.from('product-media').remove([previous.image_object_key]);
    },
    async reorderBanners(ids) {
      const { error } = await client.rpc('operations_reorder_promo_banners', { p_ids: ids });
      if (error) throw error;
    },
    async deleteBanner(id) {
      const { data: row, error: fetchError } = await client.from('promo_banners').select('image_object_key').eq('id', id).single();
      if (fetchError) throw fetchError;
      const { error } = await client.from('promo_banners').delete().eq('id', id);
      if (error) throw error;
      await client.storage.from('product-media').remove([row.image_object_key]);
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
      validateSession,
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
        if (!data.session && data.user?.identities?.length === 0) {
          throw new Error('signup_not_created');
        }
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
      async exchangeCodeForSession(code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
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
        const validation = await validateSession();
        if (!validation.session || validation.invalidated) throw new Error('SESSION_INVALID');
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
          p_bundle_ids: input.bundleIds,
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
