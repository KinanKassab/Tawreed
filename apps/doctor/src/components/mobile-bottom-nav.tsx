import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, controlHeight, spacing, typography } from '@tawreed/design-tokens';
import { AppText } from '@tawreed/ui';

const destinations = [
  { label: 'الرئيسية', icon: 'home-outline', activeIcon: 'home', href: '/(app)/(tabs)', matches: (path: string) => path === '/' },
  { label: 'المنتجات', icon: 'view-grid-outline', activeIcon: 'view-grid', href: '/(app)/(tabs)/catalog', matches: (path: string) => path === '/catalog' || path.startsWith('/product/') || path === '/cart' || path === '/checkout' },
  { label: 'طلباتي', icon: 'clipboard-text-outline', activeIcon: 'clipboard-text', href: '/(app)/(tabs)/orders', matches: (path: string) => path === '/orders' || path.startsWith('/order/') || path === '/order-success' },
  { label: 'الحساب', icon: 'account-outline', activeIcon: 'account', href: '/(app)/(tabs)/account', matches: (path: string) => path === '/account' || path === '/support' },
] as const;

export function MobileBottomNav() {
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  if (width > 680 && (width > 900 || height > 500)) return null;

  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      {destinations.map((destination) => {
        const active = destination.matches(pathname);
        return (
          <Pressable
            key={destination.label}
            accessibilityRole="tab"
            accessibilityLabel={destination.label}
            accessibilityState={{ selected: active }}
            onPress={() => router.replace(destination.href)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <MaterialCommunityIcons name={active ? destination.activeIcon : destination.icon} color={active ? colors.ink : colors.muted} size={24} />
            <AppText variant="caption" color={active ? colors.ink : colors.muted} style={active ? styles.activeLabel : styles.label}>{destination.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: controlHeight.large + 20, writingDirection: 'ltr', flexDirection: 'row-reverse', alignItems: 'flex-start', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.xs },
  item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 12 },
  pressed: { opacity: 0.68, backgroundColor: colors.pale },
  label: { fontFamily: typography.family.medium, textAlign: 'center' },
  activeLabel: { fontFamily: typography.family.semibold, fontWeight: '600', textAlign: 'center' },
});
