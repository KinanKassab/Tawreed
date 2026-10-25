import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { AppText, StateView, Surface } from '@tawreed/ui';
import { AppPage } from '@/components/app-page';
import { CatalogGrid } from '@/components/catalog-grid';
import { useCategories, useProducts } from '@/hooks/use-catalog';
import { ar } from '@/locales/ar';

type CategoryIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const categoryIcons: Record<string, CategoryIconName> = {
  'dental-01': 'tooth-outline',
  'dental-02': 'needle',
  'dental-03': 'face-mask-outline',
  'dental-04': 'medical-bag',
  'dental-05': 'tooth',
  'dental-06': 'screwdriver',
  'dental-07': 'shield-check-outline',
  'dental-08': 'stethoscope',
  'dental-09': 'link-variant',
  'dental-10': 'baby-face-outline',
  'dental-11': 'monitor',
  'dental-12': 'clipboard-check-outline',
};

export default function HomeScreen() {
  const categories = useCategories();
  const products = useProducts({ limit: 6 });
  const { width } = useWindowDimensions();
  const categoryColumns = width <= 680 ? 2 : width <= 900 ? 3 : 4;

  if (categories.isLoading || products.isLoading) {
    return <AppPage><StateView loading title={ar.loading} message={ar.loadingMessage} /></AppPage>;
  }
  if (categories.error || products.error) {
    return <AppPage><StateView title="تعذر تحميل المتجر" message="تحقق من الاتصال وحاول مجدداً." actionLabel={ar.retry} onAction={() => { categories.refetch(); products.refetch(); }} /></AppPage>;
  }

  return (
    <AppPage>
      <Surface style={styles.welcome}>
        <AppText variant="small" color={colors.green}>منصة توريد للمستلزمات الطبية</AppText>
        <AppText variant="h1">{ar.welcomeTitle}</AppText>
        <AppText variant="large" color={colors.muted}>{ar.welcomeBody}</AppText>
        <TextInput accessibilityLabel={ar.searchPlaceholder} placeholder={ar.searchPlaceholder} placeholderTextColor={colors.muted} style={styles.search} returnKeyType="search" onSubmitEditing={(event) => router.push({ pathname: '/(app)/(tabs)/catalog', params: { query: event.nativeEvent.text } })} />
      </Surface>

      <View style={styles.heading}>
        <Pressable onPress={() => router.push('/(app)/(tabs)/catalog')}><AppText variant="small" color={colors.green}>{ar.seeAll}</AppText></Pressable>
        <AppText variant="h2">{ar.categories}</AppText>
      </View>
      <View style={styles.categories}>
        {(categories.data ?? []).map((category) => (
          <View key={category.id} style={[styles.categoryCell, { width: `${100 / categoryColumns}%` }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`تصفح تصنيف ${category.nameAr}`}
              onPress={() => router.push({ pathname: '/(app)/(tabs)/catalog', params: { categoryId: category.id } })}
              style={({ pressed }) => [styles.category, pressed && styles.pressed]}
            >
              <View style={styles.categoryVisual} accessible={false} importantForAccessibility="no-hide-descendants">
                <MaterialCommunityIcons name={categoryIcons[category.slug] ?? 'medical-bag'} size={36} color={colors.deep} />
              </View>
              <AppText variant="small" style={styles.categoryLabel}>{category.nameAr}</AppText>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.heading}>
        <Pressable onPress={() => router.push('/(app)/(tabs)/catalog')}><AppText variant="small" color={colors.green}>{ar.seeAll}</AppText></Pressable>
        <AppText variant="h2">{ar.featured}</AppText>
      </View>
      <CatalogGrid products={products.data ?? []} />
    </AppPage>
  );
}

const styles = StyleSheet.create({
  welcome: { backgroundColor: colors.pale, borderWidth: 0, gap: spacing.md, paddingVertical: spacing.xxl },
  search: { minHeight: 52, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: typography.family.regular, fontSize: typography.size.body, textAlign: 'right' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categories: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -6 },
  categoryCell: { padding: 6 },
  category: { minHeight: 132, padding: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  categoryVisual: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.pale, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { textAlign: 'center' },
  pressed: { opacity: 0.72, borderColor: colors.green },
});
