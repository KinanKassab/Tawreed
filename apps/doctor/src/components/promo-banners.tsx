import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { radius, spacing } from '@tawreed/design-tokens';
import type { PromoBanner } from '@tawreed/domain';
import { MotionPressable } from '@tawreed/ui';
import { BundleOfferModal } from '@/components/bundle-offer-modal';
import { isSellableOffer } from '@/hooks/use-cart-pricing';
import { useBanners } from '@/hooks/use-catalog';

export function PromoBanners() {
  const banners = useBanners();
  if (!banners.data?.length) return null;
  return (
    <View style={styles.stack}>
      {banners.data.map((banner) => <BannerCard key={banner.id} banner={banner} />)}
    </View>
  );
}

function BannerCard({ banner }: { banner: PromoBanner }) {
  const [offerVisible, setOfferVisible] = useState(false);
  const hasBundle = isSellableOffer(banner);
  const openable = hasBundle || Boolean(banner.linkUrl);
  const onPress = () => {
    if (hasBundle) { setOfferVisible(true); return; }
    if (banner.linkUrl) void Linking.openURL(banner.linkUrl);
  };
  return (
    <>
      <MotionPressable
        accessibilityRole={openable ? 'link' : 'image'}
        accessibilityLabel={banner.titleAr}
        disabled={!openable}
        onPress={onPress}
        style={styles.card}
      >
        {banner.imageUrl ? <Image source={banner.imageUrl} contentFit="cover" style={styles.image} accessibilityLabel={banner.titleAr} /> : null}
      </MotionPressable>
      {hasBundle ? <BundleOfferModal visible={offerVisible} bannerId={banner.id} titleAr={banner.titleAr} items={banner.bundleItems!} priceUsd={banner.bundlePriceUsd!} priceSyp={banner.bundlePriceSyp!} onClose={() => setOfferVisible(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  card: { width: '100%', aspectRatio: 2, borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
