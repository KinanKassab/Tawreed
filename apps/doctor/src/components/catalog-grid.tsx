import { router } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useViewport } from '@/hooks/use-viewport';
import type { Product } from '@tawreed/domain';
import { CatalogSkeleton, ProductCard } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { useCart } from '@/store/cart';
import { useToast } from '@/store/toast';
import { Responsive } from './responsive';

const catalogColumns = (width: number) => width < 375 ? 1 : width <= 900 ? 2 : 3;

// Laid out like the grid it stands in for, on every screen size, including the pre-rendered page.
export function CatalogGridSkeleton() {
  return <Responsive>{({ width }) => <CatalogSkeleton columns={catalogColumns(width)} />}</Responsive>;
}

export function CatalogGrid({ products }: { products: Product[] }) {
  const { width } = useViewport(); const data = useData(); const add = useCart((state) => state.add);
  const showToast = useToast((state) => state.show);
  const columns = catalogColumns(width);
  return <View style={styles.grid}>{products.map((product) => <View key={product.id} style={[styles.cell, { width: `${100 / columns}%` }]}><ProductCard product={product} imageUrl={data?.media.resolve(product.media) ?? null} onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} onAdd={() => { if (product.variants.length || product.priceOnRequest) router.push({ pathname: '/product/[id]', params: { id: product.id } }); else { add(product.id); showToast('انضاف المنتج للسلة', { actionLabel: 'عرض السلة', onAction: () => router.push('/cart') }); } }} /></View>)}</View>;
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -6 }, cell: { padding: 6 } });
