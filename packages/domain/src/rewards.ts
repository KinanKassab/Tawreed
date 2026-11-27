import type { CurrencyCode, DoctorOrderStatus, Money } from './index';

export interface RewardSettings {
  friendDiscountPercent: number;
  maxPointsDiscountPercent: number;
}
export interface RewardWallet {
  code: string;
  available: number;
  pending: number;
  maxPointsDiscountPercent: number;
  history: { id: string; orderNumber: string; points: number; kind: 'earned' | 'spent'; state: 'pending' | 'available' | 'cancelled'; createdAt: string }[];
}
export interface RewardCart {
  items: { productId: string; quantity: number }[];
  bundleIds: string[];
  displayCurrency: CurrencyCode;
  code?: string;
  points?: number;
}
export interface RewardQuote {
  subtotal: Money;
  discount: Money;
  delivery: Money;
  tax: Money;
  total: Money;
  points: number;
  pointsEarned: number;
  usesRemaining: number | null;
}
export interface RewardTrackingRow {
  id: string;
  orderId: string;
  orderNumber: string;
  createdAt: string;
  buyerName: string;
  buyerPhone: string;
  ownerName: string | null;
  code: string | null;
  kind: 'friend' | 'campaign' | 'points';
  status: DoctorOrderStatus;
  rewardState: 'pending' | 'available' | 'cancelled';
  pointsEarned: number;
  pointsSpent: number;
  discount: Money;
  total: Money;
  collectedAt: string | null;
  items: { name: string; sku: string; quantity: number; total: Money }[];
}
export interface RewardTrackingFilters {
  search?: string;
  from?: string;
  to?: string;
  status?: DoctorOrderStatus | '';
  offset?: number;
}
export interface RewardCoupon {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  active: boolean;
  expiresAt: string | null;
  maxUsesPerUser: number;
}
