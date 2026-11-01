import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Icon } from './icon';
import { Image } from 'expo-image';
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput,
  type StyleProp, type TextInputProps, type TextStyle, View, type ViewProps, type ViewStyle,
} from 'react-native';
import Animated, { cancelAnimation, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { border, colors, controlHeight, layout, motion, radius, shadows, spacing, typography } from '@tawreed/design-tokens';
import { formatMoney, getAvailabilityLabel, type Availability, type Product } from '@tawreed/domain';
export { Icon, type IconName } from './icon';

type TextVariant = 'caption' | 'small' | 'body' | 'button' | 'large' | 'h3' | 'h2' | 'h1' | 'display';

export function AppText({ children, style, variant = 'body', color = colors.text, ...props }: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  variant?: TextVariant;
  color?: string;
} & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  const heading = variant === 'display' || variant.startsWith('h');
  const button = variant === 'button';
  return <Text {...props} style={[styles.text, {
    color,
    fontFamily: Platform.OS === 'web' ? typography.family.web : heading ? typography.family.bold : typography.family.regular,
    fontWeight: heading || button ? '700' : '400',
    fontSize: typography.size[variant],
    lineHeight: typography.lineHeight[variant],
  }, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'text' | 'secondary' | 'quiet';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionPressable({ style, onPressIn, onPressOut, disabled, children, ...props }: Omit<ComponentProps<typeof Pressable>, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        scale.value = reducedMotion ? 1 : withTiming(motion.pressScale, { duration: motion.duration.instant });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = reducedMotion ? 1 : withSpring(1, motion.spring);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, style }: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const normalized = variant === 'secondary' ? 'outline' : variant === 'quiet' ? 'text' : variant;
  const labelColor = normalized === 'primary' ? colors.onPrimary : normalized === 'accent' ? colors.onAccent : normalized === 'text' ? colors.textMuted : colors.primary;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        normalized === 'accent' && styles.buttonAccent,
        normalized === 'outline' && styles.buttonOutline,
        normalized === 'text' && styles.buttonText,
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      {loading ? <ActivityIndicator color={labelColor} /> : <AppText color={labelColor} variant="button" style={styles.buttonLabel}>{label}</AppText>}
    </MotionPressable>
  );
}

export function Field({ label, error, onFocus, onBlur, value, defaultValue, ...props }: TextInputProps & { label: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  const raised = focused || Boolean(value ?? defaultValue);
  return (
    <View style={styles.field}>
      <View style={[styles.inputShell, focused && styles.inputFocused, Boolean(error) && styles.inputError]}>
        <AppText variant="caption" color={focused ? colors.primary : error ? colors.error : colors.textMuted} style={[styles.inputLabel, raised ? styles.inputLabelRaised : undefined]}>{label}</AppText>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textDisabled}
          value={value}
          defaultValue={defaultValue}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          {...props}
          style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
        />
      </View>
      {error ? <AppText accessibilityRole="alert" color={colors.error} variant="small">{error}</AppText> : null}
    </View>
  );
}

export function AvailabilityBadge({ value }: { value: Availability }) {
  const palette = value === 'available'
    ? [colors.successSoft, colors.successText]
    : value === 'limited'
      ? [colors.warningSoft, colors.warningText]
      : [colors.surfaceMuted, colors.textMuted];
  return (
    <View accessibilityLabel={`حالة التوفر: ${getAvailabilityLabel(value)}`} style={[styles.badge, { backgroundColor: palette[0] }]}>
      <View style={[styles.badgeDot, { backgroundColor: palette[1] }]} />
      <AppText variant="caption" color={palette[1]}>{getAvailabilityLabel(value)}</AppText>
    </View>
  );
}

export function Surface({ children, style, ...props }: { children: ReactNode; style?: ViewStyle | ViewStyle[] } & Omit<ViewProps, 'children' | 'style'>) {
  return <View {...props} style={[styles.surface, style]}>{children}</View>;
}

export function ScreenContainer({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function StateView({ title, message, actionLabel, onAction, loading = false }: {
  title: string; message: string; actionLabel?: string; onAction?: () => void; loading?: boolean;
}) {
  return (
    <Surface style={styles.state}>
      {loading ? <ActivityIndicator size="large" color={colors.primary} /> : null}
      <AppText variant="h2" style={styles.center}>{title}</AppText>
      <AppText color={colors.textMuted} style={styles.center}>{message}</AppText>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.stateButton} /> : null}
    </Surface>
  );
}

export function ContentFade({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  return <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(motion.duration.normal)} style={style}>{children}</Animated.View>;
}

export function SkeletonBlock({ height, width = '100%', circle = false, style }: { height: number; width?: ViewStyle['width']; circle?: boolean; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) progress.value = withRepeat(withTiming(1, { duration: 1450 }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);
  const sheen = useAnimatedStyle(() => ({ transform: [{ translateX: -140 + progress.value * 520 }], opacity: reducedMotion ? 0 : 0.72 }));
  return <View accessible={false} style={[styles.skeleton, { height, width, borderRadius: circle ? height / 2 : radius.md }, style]}><Animated.View style={[styles.skeletonSheen, sheen]} /></View>;
}

export function ProductCardSkeleton() {
  return <Surface style={styles.productCard}><SkeletonBlock height={180} /><SkeletonBlock height={22} width="42%" /><SkeletonBlock height={24} width="82%" /><SkeletonBlock height={20} width="58%" /><SkeletonBlock height={24} width="48%" /><SkeletonBlock height={44} /></Surface>;
}

export function CatalogSkeleton({ count = 4 }: { count?: number }) {
  return <View accessibilityLabel="جارٍ تحميل المنتجات" style={styles.skeletonGrid}>{Array.from({ length: count }, (_, index) => <View key={index} style={styles.skeletonCell}><ProductCardSkeleton /></View>)}</View>;
}

export function HomeSkeleton() {
  return <View accessibilityLabel="جارٍ تحميل الصفحة الرئيسية" style={styles.skeletonStack}><Surface style={styles.skeletonStack}><SkeletonBlock height={20} width="44%" /><SkeletonBlock height={42} width="80%" /><SkeletonBlock height={24} width="94%" /><SkeletonBlock height={52} /><View style={styles.skeletonRow}><SkeletonBlock height={48} width="48%" /><SkeletonBlock height={48} width="48%" /></View></Surface><SkeletonBlock height={32} width="38%" /><CatalogSkeleton /></View>;
}

export function AccountSkeleton() {
  return <View accessibilityLabel="جارٍ تحميل بيانات الحساب" style={styles.skeletonStack}><SkeletonBlock height={44} width="38%" /><Surface style={styles.skeletonStack}><View style={styles.skeletonProfile}><SkeletonBlock circle height={68} width={68} /><View style={styles.skeletonProfileCopy}><SkeletonBlock height={24} width="70%" /><SkeletonBlock height={20} width="46%" /></View></View><SkeletonBlock height={52} /><SkeletonBlock height={52} /><SkeletonBlock height={96} /><SkeletonBlock height={48} /></Surface></View>;
}

export function OrdersSkeleton() {
  return <View accessibilityLabel="جارٍ تحميل الطلبات" style={styles.skeletonStack}>{[0, 1, 2].map((item) => <Surface key={item} style={styles.skeletonStack}><View style={styles.skeletonRow}><SkeletonBlock height={24} width="36%" /><SkeletonBlock height={24} width="42%" /></View><SkeletonBlock height={20} width="66%" /><SkeletonBlock height={24} width="38%" /></Surface>)}</View>;
}

export function ProductDetailSkeleton() {
  return <View accessibilityLabel="جارٍ تحميل تفاصيل المنتج" style={styles.skeletonStack}><View style={styles.skeletonDetail}><SkeletonBlock height={330} style={styles.skeletonVisual} /><View style={styles.skeletonDetailCopy}><SkeletonBlock height={22} width="36%" /><SkeletonBlock height={44} width="86%" /><SkeletonBlock height={22} width="62%" /><SkeletonBlock height={32} width="45%" /><SkeletonBlock height={48} /></View></View><SkeletonBlock height={180} /></View>;
}

export function OfflineBanner() {
  return <View accessibilityRole="alert" style={styles.offline}><AppText variant="small" color={colors.warningText}>أنت غير متصل. بعض البيانات المعروضة محفوظة وقد لا تكون محدثة.</AppText></View>;
}

export function Toast({ message = 'انضاف المنتج للسلة', actionLabel = 'عرض السلة', onAction }: { message?: string; actionLabel?: string; onAction?: () => void }) {
  return <View accessibilityRole="alert" style={styles.toast}><AppText color={colors.onToast}>{message}</AppText>{onAction ? <MotionPressable accessibilityRole="button" onPress={onAction} style={styles.toastAction}><AppText variant="button" color={colors.accent}>{actionLabel}</AppText></MotionPressable> : null}</View>;
}

export function ProductCard({ product, imageUrl, onPress, onAdd }: {
  product: Product; imageUrl: string | null; onPress: () => void; onAdd: () => void;
}) {
  const hasVariants = product.variants.length > 0;
  const orderable = hasVariants ? product.variants.some((variant) => variant.availability !== 'unavailable') : product.availability !== 'unavailable' && product.price !== null;
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>(imageUrl ? 'loading' : 'error');
  return (
    <Surface style={styles.productCard}>
      <MotionPressable accessibilityRole="link" accessibilityLabel={`عرض ${product.nameAr}`} onPress={onPress} style={styles.productImage}>
        {imageUrl && imageState !== 'error' ? <Image source={imageUrl} cachePolicy="memory-disk" contentFit="contain" style={StyleSheet.absoluteFill} accessibilityLabel={product.media?.altTextAr ?? product.nameAr} onLoadStart={() => setImageState('loading')} onLoad={() => setImageState('loaded')} onError={() => setImageState('error')} /> : null}
        {imageState === 'loading' ? <View accessibilityLabel="جارٍ تحميل صورة المنتج" style={styles.imageStatus}><ActivityIndicator color={colors.primary} /></View> : null}
        {imageState === 'error' ? <View accessibilityLabel="صورة المنتج غير متاحة" style={styles.imageStatus}><Icon name="image-off-outline" size={38} color={colors.textMuted} /><AppText variant="caption" color={colors.textMuted}>الصورة غير متاحة</AppText></View> : null}
      </MotionPressable>
      {product.price ? <AvailabilityBadge value={product.availability} /> : <View style={[styles.badge, { backgroundColor: colors.warningSoft }]}><View style={[styles.badgeDot, { backgroundColor: colors.warningText }]} /><AppText variant="caption" color={colors.warningText}>السعر والتوفر قيد التأكيد</AppText></View>}
      <AppText variant="body" style={styles.productTitle}>{product.nameAr}</AppText>
      <AppText variant="caption" color={colors.textMuted}>{[product.manufacturer, product.packageLabelAr ?? product.unitLabelAr].filter(Boolean).join(' · ')}</AppText>
      <AppText variant="body" color={colors.primary} style={styles.price}>{product.price ? `${hasVariants ? 'ابتداءً من ' : ''}${formatMoney(product.price)}` : 'السعر غير متوفر'}</AppText>
      <Button label={orderable ? hasVariants ? 'اختيار النوع' : 'إضافة للسلة' : 'غير متاح للطلب'} onPress={onAdd} disabled={!orderable} style={styles.addButton} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: 'right', writingDirection: 'rtl' },
  button: { minHeight: controlHeight.regular, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, borderWidth: border.outline, borderColor: colors.primary },
  buttonAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonOutline: { backgroundColor: colors.surface, borderColor: colors.primary },
  buttonText: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonPrimaryPressed: { backgroundColor: colors.primaryPressed, borderColor: colors.primaryPressed },
  buttonAccentPressed: { backgroundColor: colors.accentHover, borderColor: colors.accentHover },
  buttonSoftPressed: { backgroundColor: colors.primarySoft },
  buttonLabel: { textAlign: 'center' },
  focused: { borderColor: colors.focusRing, borderWidth: border.focus },
  disabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, opacity: 0.72 },
  field: { gap: spacing.xs, paddingTop: spacing.xs },
  inputShell: { minHeight: controlHeight.regular, borderWidth: border.input, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, justifyContent: 'center' },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.error },
  inputLabel: { position: 'absolute', zIndex: 1, insetInlineStart: spacing.md, backgroundColor: colors.surface, paddingHorizontal: spacing.xxs },
  inputLabelRaised: { top: -11 },
  input: { minHeight: controlHeight.regular, color: colors.text, paddingHorizontal: spacing.md, paddingTop: spacing.sm, fontFamily: Platform.OS === 'web' ? typography.family.web : typography.family.regular, fontSize: typography.size.body, textAlign: 'right', writingDirection: 'rtl' },
  inputMultiline: { minHeight: 112, paddingTop: spacing.lg, textAlignVertical: 'top' },
  badge: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end', gap: spacing.xs, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  surface: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xl },
  screen: { width: '100%', maxWidth: layout.contentMax, alignSelf: 'center', paddingHorizontal: layout.mobileGutter, gap: spacing.xl },
  state: { minHeight: 260, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  stateButton: { minWidth: 180, marginTop: spacing.sm },
  center: { textAlign: 'center' },
  offline: { backgroundColor: colors.warningSoft, borderBottomWidth: 1, borderBottomColor: colors.warning, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  toast: { minHeight: 52, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, backgroundColor: colors.toast, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toastAction: { minHeight: 44, justifyContent: 'center' },
  productCard: { flex: 1, minWidth: 0, padding: spacing.sm, gap: spacing.xs, ...shadows.soft },
  productImage: { width: '100%', aspectRatio: 1, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.imageWell },
  imageStatus: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.imageWell },
  productTitle: { minHeight: 56, fontWeight: '700' },
  price: { fontWeight: '700', marginTop: spacing.xs },
  addButton: { minHeight: 44, borderRadius: 10 },
  skeleton: { position: 'relative', overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  skeletonSheen: { position: 'absolute', top: 0, bottom: 0, width: '28%', backgroundColor: colors.primarySoft },
  skeletonStack: { gap: spacing.md },
  skeletonRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  skeletonGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -6 },
  skeletonCell: { width: '50%', padding: 6 },
  skeletonProfile: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md },
  skeletonProfileCopy: { flex: 1, gap: spacing.xs },
  skeletonDetail: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xl },
  skeletonVisual: { flex: 1, minWidth: 280 },
  skeletonDetailCopy: { flex: 1, minWidth: 280, gap: spacing.md },
});
