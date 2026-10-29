import type { ReactNode } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { colors, controlHeight, layout, radius, spacing, typography } from '@tawreed/design-tokens';
import { formatMoney, getAvailabilityLabel, type Availability, type Product } from '@tawreed/domain';

export function AppText({ children, style, variant = 'body', color = colors.ink, ...props }: {
  children: ReactNode;
  style?: TextStyle | TextStyle[];
  variant?: 'caption' | 'small' | 'body' | 'large' | 'h3' | 'h2' | 'h1';
  color?: string;
} & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  const heading = variant.startsWith('h');
  return <Text {...props} style={[styles.text, { color, fontFamily: heading ? typography.family.bold : typography.family.regular, fontWeight: heading ? '700' : '400', fontSize: typography.size[variant], lineHeight: typography.lineHeight[variant] }, style]}>{children}</Text>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, style }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'quiet' && styles.buttonQuiet,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.white : colors.ink} /> : <AppText style={variant === 'primary' ? styles.buttonLabelPrimary : styles.buttonLabel} variant="body">{label}</AppText>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <AppText variant="small">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, Boolean(error) && styles.inputError, props.style]}
      />
      {error ? <AppText accessibilityRole="alert" color={colors.danger} variant="small">{error}</AppText> : null}
    </View>
  );
}

export function AvailabilityBadge({ value }: { value: Availability }) {
  const palette = value === 'available'
    ? [colors.successSurface, colors.successText]
    : value === 'limited'
      ? [colors.warningSurface, colors.warningText]
      : [colors.unavailableSurface, colors.unavailableText];
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
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <Surface style={styles.state}>
      {loading ? <ActivityIndicator size="large" color={colors.green} /> : null}
      <AppText variant="h2" style={styles.center}>{title}</AppText>
      <AppText color={colors.muted} style={styles.center}>{message}</AppText>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.stateButton} /> : null}
    </Surface>
  );
}

export function OfflineBanner() {
  return (
    <View accessibilityRole="alert" style={styles.offline}>
      <AppText variant="small" color={colors.ink}>أنت غير متصل. بعض البيانات المعروضة محفوظة وقد لا تكون محدثة.</AppText>
    </View>
  );
}

export function ProductCard({ product, imageUrl, onPress, onAdd }: {
  product: Product;
  imageUrl: string | null;
  onPress: () => void;
  onAdd: () => void;
}) {
  const hasVariants = product.variants.length > 0;
  const orderable = hasVariants
    ? product.variants.some((variant) => variant.availability !== 'unavailable')
    : product.availability !== 'unavailable' && product.price !== null;
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>(imageUrl ? 'loading' : 'error');
  return (
    <Surface style={styles.productCard}>
      <Pressable accessibilityRole="link" accessibilityLabel={`عرض ${product.nameAr}`} onPress={onPress} style={styles.productImage}>
        {imageUrl && imageState !== 'error' ? <Image source={imageUrl} cachePolicy="memory-disk" contentFit="contain" style={StyleSheet.absoluteFill} accessibilityLabel={product.media?.altTextAr ?? product.nameAr} onLoadStart={() => setImageState('loading')} onLoad={() => setImageState('loaded')} onError={() => setImageState('error')} /> : null}
        {imageState === 'loading' ? <View accessibilityLabel="جارٍ تحميل صورة المنتج" style={styles.imageStatus}><ActivityIndicator color={colors.green} /></View> : null}
        {imageState === 'error' ? <View accessibilityLabel="صورة المنتج غير متاحة" style={styles.imageStatus}><MaterialCommunityIcons name="image-off-outline" size={38} color={colors.muted} /><AppText variant="caption" color={colors.muted}>الصورة غير متاحة</AppText></View> : null}
      </Pressable>
      {product.price ? <AvailabilityBadge value={product.availability} /> : <View style={[styles.badge, { backgroundColor: colors.warningSurface }]}><View style={[styles.badgeDot, { backgroundColor: colors.warningText }]} /><AppText variant="caption" color={colors.warningText}>السعر والتوفر قيد التأكيد</AppText></View>}
      <AppText variant="body" style={styles.productTitle}>{product.nameAr}</AppText>
      <AppText variant="caption" color={colors.muted}>{[product.manufacturer, product.packageLabelAr ?? product.unitLabelAr].filter(Boolean).join(' · ')}</AppText>
      <AppText variant="body" style={styles.price}>{product.price ? `${hasVariants ? 'ابتداءً من ' : ''}${formatMoney(product.price)}` : 'السعر غير متوفر'}</AppText>
      <Button label={orderable ? hasVariants ? 'اختيار النوع' : 'إضافة إلى السلة' : 'غير متاح للطلب'} onPress={onAdd} disabled={!orderable} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  text: { textAlign: 'right', writingDirection: 'rtl' },
  button: { minHeight: controlHeight.regular, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.ink },
  buttonSecondary: { backgroundColor: colors.white, borderColor: colors.line },
  buttonQuiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonLabelPrimary: { color: colors.white, fontFamily: typography.family.semibold, fontWeight: '600' },
  buttonLabel: { color: colors.ink, fontFamily: typography.family.semibold, fontWeight: '600' },
  pressed: { opacity: 0.78 },
  focused: { borderColor: colors.focus, borderWidth: 3 },
  disabled: { backgroundColor: colors.line, borderColor: colors.line, opacity: 0.75 },
  field: { gap: spacing.xs },
  input: { minHeight: controlHeight.regular, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, color: colors.ink, paddingHorizontal: spacing.md, fontFamily: typography.family.regular, fontSize: typography.size.body, textAlign: 'right', writingDirection: 'rtl' },
  inputMultiline: { minHeight: 104, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  badge: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end', gap: spacing.xs, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  surface: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, padding: spacing.xl },
  screen: { width: '100%', maxWidth: layout.contentMax, alignSelf: 'center', paddingHorizontal: layout.mobileGutter, gap: spacing.xl },
  state: { minHeight: 260, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  stateButton: { minWidth: 180, marginTop: spacing.sm },
  center: { textAlign: 'center' },
  offline: { backgroundColor: colors.warningSurface, borderBottomWidth: 1, borderBottomColor: colors.warningText, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  productCard: { flex: 1, minWidth: 0, padding: spacing.sm, gap: spacing.xs },
  productImage: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.pale, borderWidth: 0 },
  productPlaceholder: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.mint, alignSelf: 'center', marginTop: '35%' },
  imageStatus: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.pale },
  productTitle: { minHeight: 50, fontFamily: typography.family.semibold, fontWeight: '600' },
  price: { fontFamily: typography.family.bold, fontWeight: '700', marginTop: spacing.xs },
});
