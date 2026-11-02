import { zodResolver } from '@hookform/resolvers/zod';
import { useQueries, useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { breakpoints, colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { formatMoney, normalizeAppError, type Product } from '@tawreed/domain';
import { AppText, Button, Field, Icon, StateView, Surface } from '@tawreed/ui';
import { checkoutSchema, type CheckoutInput } from '@tawreed/validation';
import { AppPage } from '@/components/app-page';
import { useNetwork } from '@/hooks/use-network';
import { useData, useSession } from '@/providers/app-providers';
import { useCart } from '@/store/cart';
import { ar } from '@/locales/ar';

export default function CheckoutScreen() {
  const data = useData();
  const { session, revalidateSession } = useSession();
  const { online } = useNetwork();
  const { width } = useWindowDimensions();
  const compact = width < breakpoints.tablet;
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const ids = Object.keys(items);
  const [idempotencyKey] = useState(() => randomUUID());
  const profile = useQuery({ queryKey: ['profile', session?.user.id], queryFn: () => data!.profile.getMine(), enabled: Boolean(data && session) });
  const productQueries = useQueries({ queries: ids.map((id) => ({ queryKey: ['product', id], queryFn: () => data!.catalog.getProduct(id), enabled: Boolean(data) })) });
  const products = productQueries.map((query) => query.data).filter((value): value is Product => Boolean(value));
  const loadingProducts = productQueries.some((query) => query.isLoading);
  const failedProducts = productQueries.some((query) => query.isError);
  const canCheckout = products.length === ids.length && products.every((product) => product.price && product.availability !== 'unavailable');
  const currency = products[0]?.price?.currency ?? 'NEW_SYP';
  const decimalPlaces = products[0]?.price?.decimalPlaces ?? 0;
  const subtotal = products.reduce((sum, product) => product.price ? sum + product.price.amountMinor * (items[product.id] ?? 1) : sum, 0);
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    values: profile.data ? {
      recipientName: profile.data.fullName,
      recipientPhone: profile.data.phone ?? '',
      deliveryAddress: profile.data.defaultAddress ?? '',
      deliveryNotes: '',
    } : undefined,
  });

  if (!ids.length) return <AppPage><StateView title="السلة فارغة" message="أضف منتجاً قبل إتمام الطلب." actionLabel="تصفح المنتجات" onAction={() => router.replace('/(app)/(tabs)/catalog')} /></AppPage>;
  if (loadingProducts || profile.isLoading) return <AppPage><StateView loading title="نجهّز فاتورتك" message="نتحقق من الأسعار ومعلومات التوصيل." /></AppPage>;
  if (failedProducts) return <AppPage><StateView title="تعذر تحميل الفاتورة" message="تحقق من الاتصال ثم ارجع إلى السلة وحاول مجدداً." actionLabel="العودة إلى السلة" onAction={() => router.replace('/cart')} /></AppPage>;

  const submit = handleSubmit(async (values) => {
    if (!data || !online) {
      setError('root', { message: ar.offlineMutation });
      return;
    }
    if (!await revalidateSession()) {
      router.replace({ pathname: '/(auth)/login', params: { returnTo: '/checkout' } });
      return;
    }
    if (!canCheckout || !products[0]?.price) {
      setError('root', { message: 'تغيّر سعر أو توفر أحد المنتجات. ارجع إلى السلة وراجع الطلب.' });
      return;
    }
    try {
      const result = await data.orders.createOrder({
        idempotencyKey,
        displayCurrency: 'NEW_SYP',
        deliveryAddress: values.deliveryAddress,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        deliveryNotes: values.deliveryNotes,
        deliveryLatitude: profile.data?.defaultLatitude,
        deliveryLongitude: profile.data?.defaultLongitude,
        deliveryGooglePlaceId: profile.data?.defaultGooglePlaceId,
        items: ids.map((productId) => ({ productId, quantity: items[productId] ?? 1 })),
      });
      clear();
      router.replace({ pathname: '/order-success', params: result });
    } catch (error) {
      const authError = /SESSION_INVALID|ACCOUNT_UNAVAILABLE|AUTH_REQUIRED/.test(error instanceof Error ? error.message : '');
      setError('root', { message: authError ? 'انتهت الجلسة أو لم يعد الحساب متاحاً. سجّل الدخول من جديد.' : normalizeAppError(error).messageAr });
      if (authError) {
        await revalidateSession();
        router.replace({ pathname: '/(auth)/login', params: { returnTo: '/checkout' } });
      }
    }
  });

  return <AppPage>
    <View style={styles.heading}><AppText variant="h1">راجع طلبك</AppText><AppText color={colors.textMuted}>الفاتورة ومكان التوصيل في صفحة واحدة قبل الإرسال.</AppText></View>
    <View style={[styles.layout, compact && styles.layoutCompact]}>
      <View style={styles.details}>
        <Surface style={styles.deliveryCard}>
          <View style={styles.sectionTitle}><View style={styles.sectionIcon}><Icon name="map-marker-outline" size={22} color={colors.primary} /></View><View style={styles.grow}><AppText variant="h2">مكان التوصيل</AppText><AppText variant="small" color={colors.textMuted}>يمكنك تعديل المعلومات لهذا الطلب فقط.</AppText></View></View>
          <Controller control={control} name="deliveryAddress" render={({ field }) => <Field label="عنوان التوصيل" multiline value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.deliveryAddress?.message} />} />
          <View style={[styles.contactRow, compact && styles.contactRowCompact]}>
            <View style={styles.grow}><Controller control={control} name="recipientName" render={({ field }) => <Field label="اسم المستلم" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.recipientName?.message} />} /></View>
            <View style={styles.grow}><Controller control={control} name="recipientPhone" render={({ field }) => <Field label="رقم الهاتف" keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.recipientPhone?.message} />} /></View>
          </View>
          <Controller control={control} name="deliveryNotes" render={({ field }) => <Field label="ملاحظة للتوصيل (اختياري)" value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.deliveryNotes?.message} />} />
        </Surface>
        <Surface style={styles.paymentCard}><View style={styles.sectionTitle}><Icon name="currency-usd" size={22} color={colors.primary} /><View style={styles.grow}><AppText variant="h3">الدفع عند الاستلام</AppText><AppText variant="small" color={colors.textMuted}>تدفع قيمة الفاتورة عند وصول الطلب.</AppText></View></View></Surface>
      </View>
      <Surface style={styles.invoice} accessibilityLabel="فاتورة الطلب">
        <View style={styles.invoiceHeader}><View><AppText variant="h2">فاتورة الطلب</AppText><AppText variant="caption" color={colors.textMuted}>{products.length.toLocaleString('ar-SY')} أصناف</AppText></View><Icon name="clipboard-text-outline" size={26} color={colors.primary} /></View>
        <View style={styles.divider} />
        <View style={styles.invoiceLines}>{products.map((product) => {
          const quantity = items[product.id] ?? 1;
          const unitPrice = product.price!;
          return <View key={product.id} style={styles.invoiceLine}><View style={styles.lineCopy}><AppText variant="small" style={styles.semibold}>{product.nameAr}</AppText><AppText variant="caption" color={colors.textMuted}>{product.packageLabelAr ?? product.unitLabelAr} · {quantity.toLocaleString('ar-SY')} × {formatMoney(unitPrice)}</AppText></View><AppText variant="small" style={styles.lineTotal}>{formatMoney({ ...unitPrice, amountMinor: unitPrice.amountMinor * quantity })}</AppText></View>;
        })}</View>
        <View style={styles.divider} />
        <View style={styles.totalRow}><AppText variant="h2">{formatMoney({ amountMinor: subtotal, currency, decimalPlaces })}</AppText><View><AppText variant="small" color={colors.textMuted}>الإجمالي</AppText><AppText variant="caption" color={colors.successText}>التوصيل والدفع عند الاستلام</AppText></View></View>
        {!canCheckout ? <View accessibilityRole="alert" style={styles.warning}><AppText variant="small" color={colors.warningText}>تغيّر سعر أو توفر أحد المنتجات. ارجع إلى السلة وراجعه.</AppText></View> : null}
        {errors.root?.message ? <View accessibilityRole="alert" style={styles.error}><AppText variant="small" color={colors.error}>{errors.root.message}</AppText></View> : null}
        <Button label="إرسال الطلب" variant="accent" onPress={submit} loading={isSubmitting} disabled={!online || !canCheckout} />
        <AppText variant="caption" color={colors.textMuted} style={styles.center}>بإرسال الطلب أنت تؤكد صحة الفاتورة ومعلومات التوصيل.</AppText>
      </Surface>
    </View>
  </AppPage>;
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  layout: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.xl },
  layoutCompact: { flexDirection: 'column' },
  details: { flex: 1, width: '100%', gap: spacing.md },
  deliveryCard: { gap: spacing.md },
  paymentCard: { gap: spacing.sm, paddingVertical: spacing.md },
  sectionTitle: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  sectionIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  contactRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.sm },
  contactRowCompact: { flexDirection: 'column' },
  grow: { flex: 1, width: '100%', minWidth: 0 },
  invoice: { width: 400, maxWidth: '100%', gap: spacing.md, borderColor: colors.primary },
  invoiceHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  invoiceLines: { gap: spacing.md },
  invoiceLine: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  lineCopy: { flex: 1, gap: spacing.xxs },
  lineTotal: { fontFamily: typography.family.semibold, fontWeight: '600' },
  semibold: { fontFamily: typography.family.semibold, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border },
  totalRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md },
  warning: { backgroundColor: colors.warningSoft, borderColor: colors.warning, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  error: { backgroundColor: colors.surface, borderColor: colors.error, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  center: { textAlign: 'center' },
});
