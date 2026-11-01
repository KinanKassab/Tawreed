import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { formatNumber } from '@tawreed/domain';
import { AppText, Icon } from '@tawreed/ui';
import { BrandLogo } from './brand-logo';
import { GuestAuthPrompt } from './guest-auth-prompt';
import { useSession } from '@/providers/app-providers';
import { useCart } from '@/store/cart';

const navigation = [
  { href: '/(app)/(tabs)', label: 'الرئيسية' },
  { href: '/(app)/(tabs)/catalog', label: 'الأقسام' },
  { href: '/(app)/(tabs)/orders', label: 'طلباتي', returnTo: '/orders' },
  { href: '/(app)/(tabs)/account', label: 'حسابي', returnTo: '/account' },
] as const;

export function AppHeader() {
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const mobile = width <= 680 || (width <= 900 && height <= 500);
  const showBack = !['/', '/catalog', '/orders', '/account'].includes(pathname);
  const { session } = useSession();
  const [prompt, setPrompt] = useState<{ label: string; returnTo: '/orders' | '/account' } | null>(null);
  const count = useCart((state) => Object.values(state.items).reduce((sum, quantity) => sum + quantity, 0));
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)');
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.inner}>
          <View style={styles.actions}>
            {showBack ? <Pressable accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={4} onPress={goBack} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Icon name="arrow-right" color={colors.text} size={24} /></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="الإشعارات" hitSlop={4} onPress={() => router.push('/notifications')} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>{mobile ? <Icon name="bell-outline" color={colors.text} size={24} /> : <AppText variant="small">الإشعارات</AppText>}</Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`السلة، ${formatNumber(count)} منتجات`} hitSlop={4} onPress={() => router.push('/cart')} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              {mobile ? <View><Icon name="cart-outline" color={colors.text} size={25} />{count ? <View style={styles.cartBadge}><AppText variant="caption" color={colors.onPrimary} style={styles.cartBadgeText}>{formatNumber(count)}</AppText></View> : null}</View> : <AppText variant="small">السلة {count ? `(${formatNumber(count)})` : ''}</AppText>}
            </Pressable>
          </View>
          {!mobile ? <View style={styles.nav}>{navigation.map((destination) => <Pressable key={destination.href} accessibilityRole="button" onPress={() => { if ('returnTo' in destination && !session) setPrompt({ label: destination.label, returnTo: destination.returnTo }); else router.push(destination.href); }} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><AppText variant="small">{destination.label}</AppText></Pressable>)}</View> : null}
          <Pressable accessibilityRole="link" accessibilityLabel="توريد، الرئيسية" onPress={() => router.replace('/(app)/(tabs)')} style={({ pressed }) => [styles.logoButton, pressed && styles.pressed]}><BrandLogo variant={mobile ? 'symbolSmall' : 'horizontal'} width={mobile ? 32 : 132} /></Pressable>
        </View>
      </View>
      <GuestAuthPrompt visible={Boolean(prompt)} sectionLabel={prompt?.label ?? ''} returnTo={prompt?.returnTo ?? '/account'} onClose={() => setPrompt(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  inner: { width: '100%', maxWidth: 1200, minHeight: 72, paddingHorizontal: spacing.md, alignSelf: 'center', writingDirection: 'ltr', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  nav: { flexDirection: 'row-reverse', gap: spacing.xl, marginHorizontal: 'auto' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  action: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  pressed: { opacity: 0.68, backgroundColor: colors.primarySoft },
  cartBadge: { position: 'absolute', top: -8, right: -10, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.error, borderWidth: 2, borderColor: colors.surface },
  cartBadgeText: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
});
