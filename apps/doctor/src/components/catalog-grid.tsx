import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Product } from '@tawreed/domain';
import { ProductCard } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { useCart } from '@/store/cart';

export function CatalogGrid({ products }: { products: Product[] }) {
  const { width } = useWindowDimensions(); const data = useData(); const add = useCart((state) => state.add);
  const columns = width < 375 ? 1 : width <= 900 ? 2 : 3;
  return <View style={styles.grid}>{products.map((product) => <View key={product.id} style={[styles.cell, { width: `${100 / columns}%` }]}><ProductCard product={product} imageUrl={data?.media.resolve(product.media) ?? null} onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })} onAdd={() => add(product.id)} /></View>)}</View>;
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -6 }, cell: { padding: 6 } });
