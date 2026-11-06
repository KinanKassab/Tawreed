import { Image } from 'expo-image';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { radius, spacing } from '@tawreed/design-tokens';
import type { PromoBanner } from '@tawreed/domain';
import { MotionPressable } from '@tawreed/ui';
import { useBanners } from '@/hooks/use-catalog';

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
  const openable = Boolean(banner.linkUrl);
  return (
    <MotionPressable
      accessibilityRole={openable ? 'link' : 'image'}
      accessibilityLabel={banner.titleAr}
      disabled={!openable}
      onPress={() => { if (banner.linkUrl) void Linking.openURL(banner.linkUrl); }}
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
