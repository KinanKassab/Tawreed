import { router } from 'expo-router';
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { AppText, Button, ContentFade, HomeSkeleton, Icon, MotionPressable, StateView, Surface } from '@tawreed/ui';
import { AppPage } from '@/components/app-page';
import { CatalogGrid } from '@/components/catalog-grid';
import { SwipeExclusion } from '@/components/swipe-tab-navigator';
import { useCategories, useProducts } from '@/hooks/use-catalog';
import { ar } from '@/locales/ar';
import { categoryIcons } from '@/lib/category-icons';

export default function HomeScreen() {
  const categories = useCategories();
  const products = useProducts({ limit: 6 });
  const { width } = useWindowDimensions();
  const categoryColumns = width <= 680 ? 2 : width <= 900 ? 3 : 4;

  if (categories.isLoading || products.isLoading) {
    return <AppPage><HomeSkeleton /></AppPage>;
  }
  if (categories.error || products.error) {
    return <AppPage><StateView title="تعذر تحميل المتجر" message="تحقق من الاتصال وحاول مجدداً." actionLabel={ar.retry} onAction={() => { categories.refetch(); products.refetch(); }} /></AppPage>;
  }

  return (
    <AppPage><ContentFade style={styles.pageContent}>
      <Surface style={styles.welcome}>
        <AppText variant="small" color={colors.primary}>منصة توريد للمستلزمات الطبية</AppText>
        <AppText variant="h1">{ar.welcomeTitle}</AppText>
        <AppText variant="large" color={colors.textMuted}>{ar.welcomeBody}</AppText>
        <SwipeExclusion><View style={styles.searchShell}>
          <Icon name="magnify" size={24} color={colors.textMuted} />
          <TextInput accessibilityLabel={ar.searchPlaceholder} placeholder={ar.searchPlaceholder} placeholderTextColor={colors.textDisabled} style={styles.search} returnKeyType="search" onSubmitEditing={(event) => router.push({ pathname: '/(app)/(tabs)/catalog', params: { query: event.nativeEvent.text } })} />
        </View></SwipeExclusion>
        <View style={styles.heroActions}><Button label="اطلب الآن" variant="accent" onPress={() => router.push('/(app)/(tabs)/catalog')} style={styles.heroButton} /><Button label="تصفّح الأقسام" variant="outline" onPress={() => router.push('/(app)/(tabs)/catalog')} style={styles.heroButton} /></View>
      </Surface>

      <View style={styles.heading}>
        <MotionPressable onPress={() => router.push('/(app)/(tabs)/catalog')}><AppText variant="small" color={colors.primary}>{ar.seeAll}</AppText></MotionPressable>
        <AppText variant="h2">{ar.categories}</AppText>
      </View>
      <View style={styles.categories}>
        {(categories.data ?? []).map((category) => (
          <View key={category.id} style={[styles.categoryCell, { width: `${100 / categoryColumns}%` }]}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={`تصفح تصنيف ${category.nameAr}`}
              onPress={() => router.push({ pathname: '/(app)/(tabs)/catalog', params: { categoryId: category.id } })}
              style={styles.category}
            >
              <View style={styles.categoryVisual} accessible={false} importantForAccessibility="no-hide-descendants">
                <Icon name={categoryIcons[category.slug] ?? 'medical-bag'} size={36} color={colors.primaryPressed} />
              </View>
              <AppText variant="small" style={styles.categoryLabel}>{category.nameAr}</AppText>
            </MotionPressable>
          </View>
        ))}
      </View>

      <View style={styles.heading}>
        <MotionPressable onPress={() => router.push('/(app)/(tabs)/catalog')}><AppText variant="small" color={colors.primary}>{ar.seeAll}</AppText></MotionPressable>
        <AppText variant="h2">{ar.featured}</AppText>
      </View>
      <CatalogGrid products={products.data ?? []} />
    </ContentFade></AppPage>
  );
}

const styles = StyleSheet.create({
  welcome: { backgroundColor: colors.backgroundSubtle, borderWidth: 0, gap: spacing.md, paddingVertical: spacing.xxl },
  pageContent: { gap: spacing.xl },
  searchShell: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  search: { flex: 1, minHeight: 48, color: colors.text, fontFamily: typography.family.regular, fontSize: typography.size.body, textAlign: 'right' },
  heroActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  heroButton: { minWidth: 150 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categories: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -6 },
  categoryCell: { padding: 6 },
  category: { minHeight: 132, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  categoryVisual: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { textAlign: 'center' },
  pressed: { opacity: 0.72, borderColor: colors.primary },
});
