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
  price: Money;
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
  cost: Money | null;
  media: MediaAsset | null;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
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
  received: 'تم استلام الطلب',
  sourcing: 'جاري تأمين المنتجات',
  preparing: 'قيد التجهيز',
  ready_for_delivery: 'جاهز للتوصيل',
  out_for_delivery: 'قيد التوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  problem: 'مشكلة بالطلب',
};

export const getAvailabilityLabel = (value: Availability) => availabilityLabels[value];
export const getOrderStatusLabel = (value: DoctorOrderStatus) => orderStatusLabels[value];

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
      return { kind: 'unauthorized', messageAr: 'تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور، أو جهّز حساباً جديداً.', cause: error };
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
