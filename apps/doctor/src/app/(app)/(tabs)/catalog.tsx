import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { formatNumber } from '@tawreed/domain';
import { AppText, Button, ContentFade, Icon, MotionPressable, StateView } from '@tawreed/ui';
import { AppPage } from '@/components/app-page';
import { CatalogGrid, CatalogGridSkeleton } from '@/components/catalog-grid';
import { SwipeExclusion } from '@/components/swipe-tab-navigator';
import { useCategories, useInfiniteProducts } from '@/hooks/use-catalog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ar } from '@/locales/ar';
import { categoryIcons } from '@/lib/category-icons';

const SEARCH_DEBOUNCE_MS = 280;

export default function CatalogScreen() {
  const params = useLocalSearchParams<{ query?: string; categoryId?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [categoryId, setCategoryId] = useState(params.categoryId || undefined);
  const [searchFocused, setSearchFocused] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  // The tab stays mounted, so selections and searches arriving from Home must update local state.
  useEffect(() => {
    if (!params.categoryId) return undefined;
    const timer = setTimeout(() => setCategoryId(params.categoryId), 0);
    return () => clearTimeout(timer);
  }, [params.categoryId]);
  useEffect(() => {
    if (params.query === undefined) return undefined;
    const timer = setTimeout(() => setQuery(params.query ?? ''), 0);
    return () => clearTimeout(timer);
  }, [params.query]);

  const selectCategory = (id: string | undefined) => {
    setCategoryId(id);
    router.setParams({ categoryId: id ?? '' });
  };
  const categories = useCategories();
  const filters = useMemo(() => ({ query: debouncedQuery || undefined, categoryId }), [debouncedQuery, categoryId]);
  const products = useInfiniteProducts(filters);
  const rows = products.data?.pages.flat() ?? [];
  const searchPending = query.trim() !== debouncedQuery || products.isFetching;

  return (
    <AppPage>
      <AppText variant="h1">{ar.catalog}</AppText>
      <SwipeExclusion>
        <View accessibilityState={{ busy: searchPending }} style={[styles.searchShell, searchFocused && styles.searchShellFocused]}>
          <Icon name="magnify" size={24} color={searchFocused ? colors.primary : colors.textMuted} />
          <TextInput
            accessibilityLabel={ar.searchPlaceholder}
            placeholder={ar.searchPlaceholder}
            placeholderTextColor={colors.textDisabled}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCapitalize="none"
            style={styles.search}
          />
          {query ? (
            <MotionPressable accessibilityRole="button" accessibilityLabel="مسح البحث" onPress={() => setQuery('')} style={styles.clearSearch}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </MotionPressable>
          ) : null}
        </View>
      </SwipeExclusion>

      <SwipeExclusion>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
          <MotionPressable accessibilityRole="button" accessibilityState={{ selected: !categoryId }} onPress={() => selectCategory(undefined)} style={[styles.category, !categoryId && styles.categorySelected]}>
            <Icon name="view-grid-outline" size={20} color={!categoryId ? colors.onPrimary : colors.textMuted} />
            <AppText variant="caption" color={!categoryId ? colors.onPrimary : colors.text}>الكل</AppText>
          </MotionPressable>
          {(categories.data ?? []).map((category) => {
            const selected = category.id === categoryId;
            return (
              <MotionPressable key={category.id} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`تصفية حسب ${category.nameAr}`} onPress={() => selectCategory(selected ? undefined : category.id)} style={[styles.category, selected && styles.categorySelected]}>
                <Icon name={categoryIcons[category.slug] ?? 'medical-bag'} size={20} color={selected ? colors.onPrimary : colors.textMuted} />
                <AppText variant="caption" color={selected ? colors.onPrimary : colors.text}>{category.nameAr}</AppText>
              </MotionPressable>
            );
          })}
        </ScrollView>
      </SwipeExclusion>

      {/* keepPreviousData can hold an empty result from the last query; never flash "no match" for a query still loading. */}
      {products.isPending || (searchPending && !rows.length) ? <CatalogGridSkeleton /> : products.error ? (
        <StateView title="تعذر تحميل المنتجات" message="تحقق من الاتصال وحاول مجدداً." actionLabel={ar.retry} onAction={() => products.refetch()} />
      ) : rows.length ? (
        <ContentFade style={styles.results}>
          <View style={styles.result}>
            <AppText variant="small" color={colors.textMuted}>
              {searchPending ? 'جاري تحديث النتائج…' : debouncedQuery ? `${formatNumber(rows.length)} نتيجة لـ «${debouncedQuery}»` : `تم عرض ${formatNumber(rows.length)} منتجاً`}
            </AppText>
          </View>
          <CatalogGrid products={rows} />
          {products.hasNextPage ? <Button label="عرض المزيد" variant="outline" loading={products.isFetchingNextPage} onPress={() => products.fetchNextPage()} style={styles.more} /> : null}
        </ContentFade>
      ) : (
        <StateView
          title={debouncedQuery ? 'ما لقينا منتج مطابق' : ar.emptyProducts}
          message={debouncedQuery ? `جرّب اسماً آخر، مرادفاً، أو رقم SKU بدل «${debouncedQuery}».` : ar.emptyProductsMessage}
          actionLabel={debouncedQuery ? 'مسح البحث' : undefined}
          onAction={debouncedQuery ? () => setQuery('') : undefined}
        />
      )}
    </AppPage>
  );
}

const styles = StyleSheet.create({
  searchShell: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  searchShellFocused: { borderColor: colors.primary },
  search: { flex: 1, minWidth: 0, minHeight: 48, color: colors.text, fontFamily: typography.family.regular, fontSize: typography.size.body, textAlign: 'right' },
  clearSearch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  categoryStrip: { flexDirection: 'row-reverse', gap: spacing.xs, paddingVertical: spacing.xs },
  category: { minHeight: 44, minWidth: 64, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface },
  categorySelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  results: { gap: spacing.xl },
  result: { alignItems: 'flex-end', minHeight: 24 },
  more: { alignSelf: 'center', minWidth: 220 },
});
