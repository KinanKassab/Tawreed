export type Availability = 'available' | 'limited' | 'unavailable';
export type CurrencyCode = 'USD' | 'NEW_SYP';

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
  decimalPlaces: number;
}

export interface MediaAsset {
  id: string;
  provider: 'supabase' | 'external' | 'cdn';
  objectKey: string | null;
  externalUrl: string | null;
  altTextAr: string;
  width: number | null;
  height: number | null;
}

export interface Category {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
}

export interface BundleItem {
  productId: string;
  quantity: number;
}

export interface PromoBanner {
  id: string;
  titleAr: string;
  imageUrl: string | null;
  linkUrl: string | null;
  bundleItems: BundleItem[] | null;
}

export interface OperationsPromoBanner extends PromoBanner {
  sortOrder: number;
  active: boolean;
  expiresAt: string | null;
}

export interface Product {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string | null;
  manufacturer: string | null;
  unitLabelAr: string;
  packageLabelAr: string | null;
  descriptionAr: string | null;
  specificationsAr: string | null;
  availability: Availability;
  category: Category;
  price: Money | null;
  priceOnRequest: boolean;
  media: MediaAsset | null;
  variantLabelAr: string | null;
  variants: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  sku: string;
  labelAr: string;
  nameAr: string;
  nameEn: string | null;
  manufacturer: string | null;
  unitLabelAr: string;
  packageLabelAr: string | null;
  descriptionAr: string | null;
  specificationsAr: string | null;
  media: MediaAsset | null;
  price: Money | null;
  priceOnRequest: boolean;
  availability: Availability;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export type DoctorOrderStatus =
  | 'received'
  | 'sourcing'
  | 'preparing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'problem';

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: DoctorOrderStatus;
  createdAt: string;
  itemCount: number;
  total: Money;
}

export interface OrderDetail extends OrderSummary {
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  deliveryNotes: string | null;
  items: {
    id: string;
    productId: string | null;
    sku: string;
    nameAr: string;
    unitLabelAr: string;
    packageLabelAr: string | null;
    quantity: number;
    unitPrice: Money;
    lineTotal: Money;
  }[];
  history: { id: string; status: DoctorOrderStatus; messageAr: string | null; createdAt: string }[];
}

export interface DoctorProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  clinicName: string | null;
  phone: string | null;
  email: string | null;
  preferredContact: 'phone' | 'whatsapp' | 'email';
  defaultAddress: string | null;
  defaultLatitude: number | null;
  defaultLongitude: number | null;
  defaultGooglePlaceId: string | null;
}

export type StaffRank = 'operations_manager' | 'admin' | 'owner';

export interface OperationsOrder {
  id: string;
  orderNumber: string;
  status: DoctorOrderStatus;
  createdAt: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  itemCount: number;
  total: Money;
}

export interface OperationsOrderDetail extends OperationsOrder {
  deliveryNotes: string | null;
  items: {
    id: string;
    productId: string | null;
    sku: string;
    nameAr: string;
    unitLabelAr: string;
    packageLabelAr: string | null;
    quantity: number;
    unitPrice: Money;
    lineTotal: Money;
  }[];
}

export interface OperationsProduct {
  id: string;
  sku: string;
  nameAr: string;
  manufacturer: string | null;
  unitLabelAr: string;
  packageLabelAr: string | null;
  descriptionAr: string | null;
  specificationsAr: string | null;
  availability: Availability;
  active: boolean;
  price: Money | null;
  priceOnRequest: boolean;
  cost: Money | null;
  media: MediaAsset | null;
  gallery: OperationsProductImage[];
  category: Category | null;
  variantGroupKey: string | null;
  variantLabelAr: string | null;
  variantSortOrder: number;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
}

export interface OperationsProductImage extends MediaAsset {
  isPrimary: boolean;
  sortOrder: number;
}

/** One Doctor-facing product: a standalone row, or every option sharing a variant group. */
export interface OperationsProductGroup {
  key: string;
  variantGroupKey: string | null;
  options: OperationsProduct[];
}

export function groupOperationsProducts(products: OperationsProduct[]): OperationsProductGroup[] {
  const groups = new Map<string, OperationsProductGroup>();
  for (const product of products) {
    const key = product.variantGroupKey ?? product.id;
    const group = groups.get(key) ?? { key, variantGroupKey: product.variantGroupKey, options: [] };
    group.options.push(product);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.options.sort((left, right) => Number(right.active) - Number(left.active)
      || left.variantSortOrder - right.variantSortOrder
      || (left.variantLabelAr ?? '').localeCompare(right.variantLabelAr ?? '', 'ar'));
  }
  return [...groups.values()];
}

/**
 * The option a Doctor-facing group card actually represents: the cheapest active, priced
 * option (matching the Doctor catalog's own selection). Falls back to the first active option,
 * then the first option, so a group with nothing priced yet still has something to show.
 * Operations surfaces must use this for a group's price/image summary instead of ad-hoc
 * "first option" picks, or they can silently disagree with what Doctors actually see.
 */
export function pickDisplayedOption(options: OperationsProduct[]): OperationsProduct | null {
  const priced = options.filter((option) => option.active && option.price);
  const cheapest = [...priced].sort((left, right) => left.price!.amountMinor - right.price!.amountMinor)[0];
  return cheapest ?? options.find((option) => option.active) ?? options[0] ?? null;
}

export interface OperationsExchangeRate {
  id: string;
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  rate: number;
  effectiveAt: string;
}

export interface AppError {
  kind: 'network' | 'unauthorized' | 'validation' | 'server' | 'unavailable' | 'offline_unsupported' | 'configuration';
  messageAr: string;
  cause?: unknown;
}

const availabilityLabels: Record<Availability, string> = {
  available: 'متوفر',
  limited: 'محدود',
  unavailable: 'غير موجود',
};

const orderStatusLabels: Record<DoctorOrderStatus, string> = {
  received: 'وصلنا الطلب وعم نحضّره لنبعتلك ياه',
  sourcing: 'وصلنا الطلب وعم نحضّره لنبعتلك ياه',
  preparing: 'وصلنا الطلب وعم نحضّره لنبعتلك ياه',
  ready_for_delivery: 'وصلنا الطلب وعم نحضّره لنبعتلك ياه',
  out_for_delivery: 'عم نوصّله',
  delivered: 'وصل',
  cancelled: 'ملغي',
  problem: 'مشكلة بالطلب',
};

export const getAvailabilityLabel = (value: Availability) => availabilityLabels[value];
export const getOrderStatusLabel = (value: DoctorOrderStatus) => orderStatusLabels[value];

/** Collapses internal fulfilment states into the three stages shown to Doctors. */
export const getOrderTrackingStep = (value: DoctorOrderStatus): 0 | 1 | 2 => {
  if (value === 'delivered') return 2;
  if (value === 'out_for_delivery') return 1;
  return 0;
};

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', options).format(value);
}

export function formatMoney(money: Money, locale = 'en-US'): string {
  const amount = money.amountMinor / 10 ** money.decimalPlaces;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: money.decimalPlaces,
    maximumFractionDigits: money.decimalPlaces,
  }).format(amount) + ` ${money.currency === 'NEW_SYP' ? 'SYP' : 'USD'}`;
}

export const roundSypTo50 = (amount: number): number => Math.ceil(amount / 50) * 50;

export function calculateSubtotal(lines: readonly { quantity: number; unitPriceMinor: number }[]): number {
  return lines.reduce((sum, line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 0 || !Number.isInteger(line.unitPriceMinor)) {
      throw new Error('Invalid cart line');
    }
    return sum + line.quantity * line.unitPriceMinor;
  }, 0);
}

export function normalizeAppError(error: unknown): AppError {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message).toLowerCase();
    if (message.includes('invalid login credentials')) {
      return { kind: 'unauthorized', messageAr: 'البريد أو كلمة السر غير صحيحة.', cause: error };
    }
    if (message.includes('refresh token') || message.includes('session_not_found')) {
      return { kind: 'unauthorized', messageAr: 'انتهت جلستك. سجّل الدخول مجدداً.', cause: error };
    }
    if (message.includes('email not confirmed')) {
      return { kind: 'unauthorized', messageAr: 'يرجى تأكيد البريد الإلكتروني قبل تسجيل الدخول.', cause: error };
    }
    if (message.includes('user already registered')) {
      return { kind: 'validation', messageAr: 'يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.', cause: error };
    }
    if (message.includes('signup_not_created')) {
      return { kind: 'validation', messageAr: 'تعذر إكمال إنشاء الحساب. إذا استخدمت هذا البريد سابقاً، سجّل الدخول أو استعد كلمة المرور.', cause: error };
    }
    if (message.includes('network') || message.includes('fetch')) {
      return { kind: 'network', messageAr: 'تعذر الاتصال بالإنترنت. تحقق من الشبكة وحاول مجدداً.', cause: error };
    }
    if (message.includes('jwt') || message.includes('unauthorized')) {
      return { kind: 'unauthorized', messageAr: 'انتهت الجلسة. سجّل الدخول مجدداً.', cause: error };
    }
  }
  return { kind: 'server', messageAr: 'حدث خطأ غير متوقع. حاول مجدداً بعد قليل.', cause: error };
}
