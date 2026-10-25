import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { AppText, Button, StateView } from '@tawreed/ui';
import { AppPage } from '@/components/app-page'; import { CatalogGrid } from '@/components/catalog-grid'; import { useInfiniteProducts } from '@/hooks/use-catalog'; import { ar } from '@/locales/ar';
export default function CatalogScreen() {
  const params = useLocalSearchParams<{ query?: string; categoryId?: string }>(); const [query, setQuery] = useState(params.query ?? '');
  const filters = useMemo(() => ({ query: query.trim() || undefined, categoryId: params.categoryId }), [query, params.categoryId]); const products = useInfiniteProducts(filters); const rows = products.data?.pages.flat() ?? [];
  return <AppPage><AppText variant="h1">{ar.catalog}</AppText><TextInput accessibilityLabel={ar.searchPlaceholder} placeholder={ar.searchPlaceholder} placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.search} />{products.isLoading ? <StateView loading title={ar.loading} message={ar.loadingMessage} /> : products.error ? <StateView title="تعذر تحميل المنتجات" message="تحقق من الاتصال وحاول مجدداً." actionLabel={ar.retry} onAction={() => products.refetch()} /> : rows.length ? <><View style={styles.result}><AppText variant="small" color={colors.muted}>تم عرض {rows.length.toLocaleString('ar-SY')} منتجاً</AppText></View><CatalogGrid products={rows} />{products.hasNextPage ? <Button label="عرض المزيد" variant="secondary" loading={products.isFetchingNextPage} onPress={() => products.fetchNextPage()} style={styles.more} /> : null}</> : <StateView title={ar.emptyProducts} message={ar.emptyProductsMessage} />}</AppPage>;
}
const styles = StyleSheet.create({ search: { minHeight: 52, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: typography.family.regular, fontSize: typography.size.body, textAlign: 'right' }, result: { alignItems: 'flex-end' }, more: { alignSelf: 'center', minWidth: 220 } });
