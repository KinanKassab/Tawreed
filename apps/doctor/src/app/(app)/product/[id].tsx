import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { colors, motion, radius, spacing } from '@tawreed/design-tokens';
import { formatMoney, formatNumber } from '@tawreed/domain';
import { AppText, AvailabilityBadge, Button, Icon, MotionPressable, ProductDetailSkeleton, StateView, Surface } from '@tawreed/ui';
import { AppPage } from '@/components/app-page';
import { useProduct } from '@/hooks/use-catalog';
import { useData } from '@/providers/app-providers';
import { useCart } from '@/store/cart';

export default function ProductScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const product = useProduct(id);
  const data = useData();
  const add = useCart((state) => state.add);
  const reducedMotion = useReducedMotion();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const item = product.data;
  const selectedVariant = item?.variants.find((variant) => variant.id === selectedVariantId)
    ?? item?.variants.find((variant) => variant.id === item.id)
    ?? item?.variants[0];

  if (product.isLoading) return <AppPage><ProductDetailSkeleton /></AppPage>;
  if (!item) return <AppPage><StateView title="المنتج غير موجود" message="قد يكون المنتج غير متاح أو تم إيقافه." actionLabel="العودة للمنتجات" onAction={() => router.replace('/(app)/(tabs)/catalog')} /></AppPage>;

  const selectedId = selectedVariant?.id ?? item.id;
  const details = selectedVariant ?? item;
  const selectedPrice = selectedVariant?.price ?? item.price;
  const selectedAvailability = selectedVariant?.availability ?? item.availability;
  const image = data?.media.resolve(details.media);
  const orderable = selectedAvailability !== 'unavailable' && selectedPrice !== null;
  const transition = reducedMotion ? undefined : FadeIn.duration(motion.duration.normal);

  return <AppPage>
    <Animated.View key={selectedId} entering={transition} exiting={reducedMotion ? undefined : FadeOut.duration(motion.duration.fast)} style={styles.detail}>
      <Surface style={styles.visual}>
        {image && imageState !== 'error' ? <Image source={image} cachePolicy="memory-disk" contentFit="contain" style={styles.image} accessibilityLabel={details.media?.altTextAr ?? details.nameAr} onLoadStart={() => setImageState('loading')} onLoad={() => setImageState('loaded')} onError={() => setImageState('error')} /> : null}
        {image && imageState === 'loading' ? <ActivityIndicator accessibilityLabel="جارٍ تحميل صورة المنتج" size="large" color={colors.primary} style={styles.imageStatus} /> : null}
        {!image || imageState === 'error' ? <View accessibilityLabel="صورة المنتج غير متاحة" style={styles.fallback}><Icon name="image-off-outline" size={64} color={colors.textMuted} /><AppText color={colors.textMuted}>الصورة غير متاحة</AppText></View> : null}
      </Surface>
      <View style={styles.copy}>
        {selectedPrice ? <AvailabilityBadge value={selectedAvailability} /> : <AppText variant="small" color={colors.warningText}>بانتظار التحقق من السعر والتوفر</AppText>}
        <AppText variant="h1">{details.nameAr}</AppText>
        {details.nameEn ? <AppText color={colors.textMuted}>{details.nameEn}</AppText> : null}
        <AppText color={colors.textMuted}>{[details.manufacturer, details.unitLabelAr, details.packageLabelAr].filter(Boolean).join(' · ')}</AppText>
        {item.variants.length ? <View style={styles.variants}><AppText variant="small">اختر النوع أو العبوة</AppText><View style={styles.variantOptions}>{item.variants.map((variant) => {
          const selected = variant.id === selectedId;
          return <MotionPressable key={variant.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { setImageState('loading'); setSelectedVariantId(variant.id); }} style={[styles.variantOption, selected && styles.variantOptionSelected]}><AppText variant="small" color={selected ? colors.onPrimary : colors.text}>{variant.labelAr}</AppText><AppText variant="caption" color={selected ? colors.onPrimary : colors.textMuted}>{formatMoney(variant.price)}</AppText></MotionPressable>;
        })}</View></View> : null}
        <AppText variant="h2" color={colors.primary}>{selectedPrice ? formatMoney(selectedPrice) : 'السعر غير متوفر'}</AppText>
        {orderable ? <View style={styles.quantity}><MotionPressable accessibilityRole="button" accessibilityLabel="زيادة الكمية" onPress={() => setQuantity((value) => value + 1)} style={styles.quantityButton}><AppText variant="h3">+</AppText></MotionPressable><AppText>{formatNumber(quantity)}</AppText><MotionPressable accessibilityRole="button" accessibilityLabel="تقليل الكمية" accessibilityState={{ disabled: quantity === 1 }} disabled={quantity === 1} onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={styles.quantityButton}><AppText variant="h3">−</AppText></MotionPressable></View> : null}
        <Button label={orderable ? 'اطلب الآن' : 'غير متاح للطلب'} variant="accent" disabled={!orderable} onPress={() => { add(selectedId, quantity); router.push('/cart'); }} />
      </View>
    </Animated.View>
    <Animated.View key={`info-${selectedId}`} entering={transition} style={styles.sections}>
      <Surface style={styles.section}><View style={styles.sectionTitle}><Icon name="information-outline" size={24} color={colors.primary} /><AppText variant="h2">عن المنتج</AppText></View><AppText color={colors.textMuted}>{details.descriptionAr ?? 'لا تتوفر تفاصيل إضافية لهذا المنتج حالياً.'}</AppText>{details.specificationsAr ? <><View style={styles.sectionTitle}><Icon name="clipboard-list-outline" size={22} color={colors.primary} /><AppText variant="h3">المواصفات والخيارات</AppText></View><AppText color={colors.textMuted}>{details.specificationsAr}</AppText></> : null}</Surface>
      <Surface style={styles.section}><View style={styles.sectionTitle}><Icon name="package-variant-closed" size={24} color={colors.primary} /><AppText variant="h2">معلومات المنتج</AppText></View><AppText color={colors.textMuted}>وحدة البيع: {details.packageLabelAr ?? details.unitLabelAr}</AppText><AppText color={colors.textMuted}>رمز المنتج: {selectedVariant?.sku ?? item.sku}</AppText>{!selectedPrice ? <AppText color={colors.textMuted}>سيُتاح الطلب بعد تأكيد السعر والتوفر.</AppText> : null}</Surface>
    </Animated.View>
  </AppPage>;
}

const styles = StyleSheet.create({
  detail: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xxl },
  visual: { flex: 1, minWidth: 300, minHeight: 360, backgroundColor: colors.imageWell, alignItems: 'center', justifyContent: 'center' },
  image: { width: '90%', height: '90%' }, imageStatus: { position: 'absolute' }, fallback: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  copy: { flex: 1, minWidth: 280, gap: spacing.md, justifyContent: 'center' }, variants: { gap: spacing.sm }, variantOptions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  variantOption: { minWidth: 110, minHeight: 48, justifyContent: 'center', gap: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface },
  variantOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  quantity: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, maxWidth: 180 },
  quantityButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, sections: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xl }, section: { flex: 1, minWidth: 280, gap: spacing.md }, sectionTitle: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
});
