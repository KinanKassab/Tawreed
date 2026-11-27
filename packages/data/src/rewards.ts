import type { SupabaseClient } from '@supabase/supabase-js';
import type { RewardCart, RewardCoupon, RewardQuote, RewardSettings, RewardTrackingFilters, RewardTrackingRow, RewardWallet } from '@tawreed/domain';

export interface RewardOrderInput extends RewardCart {
  idempotencyKey: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  deliveryNotes?: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  deliveryGooglePlaceId?: string | null;
  expectedQuote: RewardQuote;
}
export function createRewardsRepository(client: SupabaseClient) {
  async function call<T>(action: string, input: object = {}): Promise<T> {
    const { data, error } = await client.rpc('reward_api', { p_action: action, p_input: input });
    if (error) throw error;
    return data as T;
  }
  return {
    wallet: () => call<RewardWallet>('wallet'),
    quote: (input: RewardCart) => call<RewardQuote>('quote', input),
    placeOrder: (input: RewardOrderInput) => call<{ orderId: string; orderNumber: string }>('place', input),
    tracking: (filters: RewardTrackingFilters) => call<{ rows: RewardTrackingRow[]; hasMore: boolean }>('tracking', filters),
    settings: () => call<RewardSettings>('settings'),
    saveSettings: (input: RewardSettings) => call<void>('save_settings', input),
    coupons: () => call<RewardCoupon[]>('coupons'),
    saveCoupon: (input: RewardCoupon) => call<void>('save_coupon', input),
    collect: (orderId: string) => call<void>('collect', { orderId }),
  };
}
export type RewardsRepository = ReturnType<typeof createRewardsRepository>;
