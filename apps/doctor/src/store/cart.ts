import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartBundle { id: string; label: string; productIds: string[] }
interface CartState {
  items: Record<string, number>;
  bundles: CartBundle[];
  add: (productId: string, quantity?: number) => void;
  addBundle: (bundle: CartBundle, items: { productId: string; quantity: number }[]) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  removeBundle: (id: string) => void;
  clear: () => void;
}
export const useCart = create<CartState>()(persist((set) => ({
  items: {},
  bundles: [],
  add: (productId, quantity = 1) => set((state) => ({ items: { ...state.items, [productId]: (state.items[productId] ?? 0) + quantity } })),
  addBundle: (bundle, bundleItems) => set((state) => ({
    items: bundleItems.reduce((items, item) => ({ ...items, [item.productId]: (items[item.productId] ?? 0) + item.quantity }), { ...state.items }),
    bundles: [...state.bundles.filter((existing) => existing.id !== bundle.id), bundle],
  })),
  setQuantity: (productId, quantity) => set((state) => { const items = { ...state.items }; if (quantity <= 0) delete items[productId]; else items[productId] = quantity; return { items }; }),
  remove: (productId) => set((state) => { const items = { ...state.items }; delete items[productId]; return { items }; }),
  removeBundle: (id) => set((state) => { const bundle = state.bundles.find((candidate) => candidate.id === id); const items = { ...state.items }; bundle?.productIds.forEach((productId) => delete items[productId]); return { items, bundles: state.bundles.filter((candidate) => candidate.id !== id) }; }),
  clear: () => set({ items: {}, bundles: [] }),
}), { name: 'tawreed-cart-v2', storage: createJSONStorage(() => AsyncStorage), partialize: (state) => ({ items: state.items, bundles: state.bundles }),
  // Web pages are pre-rendered with an empty cart; the root layout rehydrates once the page has hydrated.
  skipHydration: Platform.OS === 'web' }));
