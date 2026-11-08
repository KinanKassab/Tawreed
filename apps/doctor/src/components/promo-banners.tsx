import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { radius, spacing } from '@tawreed/design-tokens';
import type { PromoBanner } from '@tawreed/domain';
import { MotionPressable } from '@tawreed/ui';
import { useBanners } from '@/hooks/use-catalog';
import { useCart } from '@/store/cart';

export function PromoBanners() {
  const banners = useBanners();
  if (!banners.data?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {banners.data.map((banner) => <BannerCard key={banner.id} banner={banner} />)}
    </ScrollView>
  );
}

function BannerCard({ banner }: { banner: PromoBanner }) {
  const add = useCart((state) => state.add);
  const hasBundle = Boolean(banner.bundleItems?.length);
  const openable = hasBundle || Boolean(banner.linkUrl);
  const onPress = () => {
    if (banner.bundleItems?.length) {
      banner.bundleItems.forEach((item) => add(item.productId, item.quantity));
      router.push('/cart');
      return;
    }
    if (banner.linkUrl) void Linking.openURL(banner.linkUrl);
  };
  return (
    <MotionPressable
      accessibilityRole={openable ? 'link' : 'image'}
      accessibilityLabel={banner.titleAr}
      disabled={!openable}
      onPress={onPress}
      style={styles.card}
    >
      {banner.imageUrl ? <Image source={banner.imageUrl} contentFit="cover" style={styles.image} accessibilityLabel={banner.titleAr} /> : null}
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', gap: spacing.sm },
  card: { width: 300, height: 140, borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
