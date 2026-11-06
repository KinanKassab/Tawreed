import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useViewport } from '@/hooks/use-viewport';
import type { Product } from '@tawreed/domain';
import { CatalogSkeleton, ProductCard, Toast } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { useCart } from '@/store/cart';
import { Responsive } from './responsive';

const catalogColumns = (width: number) => width < 375 ? 1 : width <= 900 ? 2 : 3;

// Laid out like the grid it stands in for, on every screen size, including the pre-rendered page.
export function CatalogGridSkeleton() {
  return <Responsive>{({ width }) => <CatalogSkeleton columns={catalogColumns(width)} />}</Responsive>;
}

export function CatalogGrid({ products }: { products: Product[] }) {
  const { width } = useViewport(); const data = useData(); const add = useCart((state) => state.add);
  const [showToast, setShowToast] = useState(false);
  const columns = catalogColumns(width);
  useEffect(() => { if (!showToast) return; const timer = setTimeout(() => setShowToast(false), 3200); return () => clearTimeout(timer); }, [showToast]);
  return <><View style={styles.grid}>{products.map((product) => <View key={product.id} style={[styles.cell, { width: `${100 / columns}%` }]}><ProductCard product={product} imageUrl={data?.media.resolve(product.media) ?? null} onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} onAdd={() => { if (product.variants.length || product.priceOnRequest) router.push({ pathname: '/product/[id]', params: { id: product.id } }); else { add(product.id); setShowToast(true); } }} /></View>)}</View>{showToast ? <View style={styles.toast}><Toast onAction={() => router.push('/cart')} /></View> : null}</>;
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -6 }, cell: { padding: 6 }, toast: { position: 'absolute', insetInlineStart: 16, insetInlineEnd: 16, bottom: 96, zIndex: 20 } });
