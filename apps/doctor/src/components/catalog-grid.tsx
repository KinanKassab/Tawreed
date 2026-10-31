import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Product } from '@tawreed/domain';
import { ProductCard, Toast } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { useCart } from '@/store/cart';

export function CatalogGrid({ products }: { products: Product[] }) {
  const { width } = useWindowDimensions(); const data = useData(); const add = useCart((state) => state.add);
  const [showToast, setShowToast] = useState(false);
  const columns = width < 375 ? 1 : width <= 900 ? 2 : 3;
  useEffect(() => { if (!showToast) return; const timer = setTimeout(() => setShowToast(false), 3200); return () => clearTimeout(timer); }, [showToast]);
  return <><View style={styles.grid}>{products.map((product) => <View key={product.id} style={[styles.cell, { width: `${100 / columns}%` }]}><ProductCard product={product} imageUrl={data?.media.resolve(product.media) ?? null} onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} onAdd={() => { if (product.variants.length) router.push({ pathname: '/product/[id]', params: { id: product.id } }); else { add(product.id); setShowToast(true); } }} /></View>)}</View>{showToast ? <View style={styles.toast}><Toast onAction={() => router.push('/cart')} /></View> : null}</>;
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -6 }, cell: { padding: 6 }, toast: { position: 'absolute', insetInlineStart: 16, insetInlineEnd: 16, bottom: 96, zIndex: 20 } });
