import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface CartState { items: Record<string, number>; add: (productId: string, quantity?: number) => void; setQuantity: (productId: string, quantity: number) => void; remove: (productId: string) => void; clear: () => void; }
export const useCart = create<CartState>()(persist((set) => ({
  items: {},
  add: (productId, quantity = 1) => set((state) => ({ items: { ...state.items, [productId]: (state.items[productId] ?? 0) + quantity } })),
  setQuantity: (productId, quantity) => set((state) => { const items = { ...state.items }; if (quantity <= 0) delete items[productId]; else items[productId] = quantity; return { items }; }),
  remove: (productId) => set((state) => { const items = { ...state.items }; delete items[productId]; return { items }; }), clear: () => set({ items: {} }),
}), { name: 'tawreed-cart-v1', storage: createJSONStorage(() => AsyncStorage), partialize: (state) => ({ items: state.items }) }));
