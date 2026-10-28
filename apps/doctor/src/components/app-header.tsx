import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, usePathname } from 'expo-router';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors, spacing, typography } from '@tawreed/design-tokens';
import { AppText } from '@tawreed/ui';
import { useCart } from '@/store/cart';

export function AppHeader() {
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const mobile = width <= 680 || (width <= 900 && height <= 500);
  const showBack = !['/', '/catalog', '/orders', '/account'].includes(pathname);
  const count = useCart((state) => Object.values(state.items).reduce((sum, quantity) => sum + quantity, 0));
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)');
  };

  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <View style={styles.actions}>
          {showBack ? <Pressable accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={4} onPress={goBack} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><MaterialCommunityIcons name="arrow-right" color={colors.ink} size={24} /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="الإشعارات" hitSlop={4} onPress={() => router.push('/notifications')} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>{mobile ? <MaterialCommunityIcons name="bell-outline" color={colors.ink} size={24} /> : <AppText variant="small">الإشعارات</AppText>}</Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`السلة، ${count.toLocaleString('ar-SY')} منتجات`} hitSlop={4} onPress={() => router.push('/cart')} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            {mobile ? <View><MaterialCommunityIcons name="cart-outline" color={colors.ink} size={25} />{count ? <View style={styles.cartBadge}><AppText variant="caption" color={colors.white} style={styles.cartBadgeText}>{count.toLocaleString('ar-SY')}</AppText></View> : null}</View> : <AppText variant="small">السلة {count ? `(${count.toLocaleString('ar-SY')})` : ''}</AppText>}
          </Pressable>
        </View>
        {!mobile ? <View style={styles.nav}>{[['/(app)/(tabs)','الرئيسية'],['/(app)/(tabs)/catalog','المنتجات'],['/(app)/(tabs)/orders','طلباتي'],['/(app)/(tabs)/account','الحساب']].map(([href,label]) => <Pressable key={href} onPress={() => router.push(href as never)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><AppText variant="small">{label}</AppText></Pressable>)}</View> : null}
        <Pressable accessibilityRole="link" accessibilityLabel="توريد، الرئيسية" onPress={() => router.replace('/(app)/(tabs)')} style={({ pressed }) => [styles.logoButton, pressed && styles.pressed]}>
          <Image accessibilityIgnoresInvertColors source={require('../../assets/images/brand-logo.png')} style={styles.logoImage} />
          {!mobile ? <AppText variant="h3" style={styles.logo}>توريد</AppText> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  inner: { width: '100%', maxWidth: 1200, minHeight: 72, paddingHorizontal: spacing.md, alignSelf: 'center', writingDirection: 'ltr', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoButton: { minHeight: 48, minWidth: 48, flexDirection: 'row-reverse', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  logoImage: { width: 44, height: 44, borderRadius: 11 },
  logo: { fontFamily: typography.family.bold, fontWeight: '700' },
  nav: { flexDirection: 'row-reverse', gap: spacing.xl, marginHorizontal: 'auto' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  action: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  pressed: { opacity: 0.68, backgroundColor: colors.pale },
  cartBadge: { position: 'absolute', top: -8, right: -10, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.white },
  cartBadgeText: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
});
