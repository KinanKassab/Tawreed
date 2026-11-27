import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { breakpoints, colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { formatMoney, normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Icon, StateView, Surface } from '@tawreed/ui';
import { checkoutSchema, type CheckoutInput } from '@tawreed/validation';
import { AppPage } from '@/components/app-page';
import { useCartPricing } from '@/hooks/use-cart-pricing';
import { useNetwork } from '@/hooks/use-network';
import { useData, useSession } from '@/providers/app-providers';
import { useCart } from '@/store/cart';
import { useToast } from '@/store/toast';
import { ar } from '@/locales/ar';

export default function CheckoutScreen() {
  const data = useData();
  const { session, revalidateSession } = useSession();
  const { online } = useNetwork();
  const { width } = useWindowDimensions();
  const compact = width < breakpoints.tablet;
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const [idempotencyKey] = useState(() => randomUUID());
  const queryClient = useQueryClient();
  const [codeDraft, setCodeDraft] = useState('');
  const [code, setCode] = useState('');
  const [pointsDraft, setPointsDraft] = useState('');
  const [points, setPoints] = useState(0);
  const profile = useQuery({ queryKey: ['profile', session?.user.id], queryFn: () => data!.profile.getMine(), enabled: Boolean(data && session) });
  const { ids, products, bundles, looseLines, subtotal, currency, decimalPlaces, loading: loadingProducts, failed: failedProducts, canCheckout } = useCartPricing();
  const rewardCart = { items: ids.map((productId) => ({ productId, quantity: items[productId] ?? 1 })), bundleIds: bundles.map((bundle) => bundle.id), displayCurrency: currency, code, points };
  const wallet = useQuery({ queryKey: ['reward-wallet', session?.user.id], queryFn: () => data!.rewards.wallet(), enabled: Boolean(data && session && online) });
  const quote = useQuery({ queryKey: ['reward-quote', session?.user.id, rewardCart], queryFn: () => data!.rewards.quote(rewardCart), enabled: Boolean(data && session && online && !loadingProducts && canCheckout && ids.length), retry: false, staleTime: 0 });
  const showToast = useToast((state) => state.show);
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError, reset } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { recipientName: '', recipientPhone: '', deliveryAddress: '', deliveryNotes: '' },
  });
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !profile.data) return;
    prefilled.current = true;
    reset({
      recipientName: profile.data.fullName,
      recipientPhone: profile.data.phone ?? '',
      deliveryAddress: profile.data.defaultAddress ?? '',
      deliveryNotes: '',
    });
  }, [profile.data, reset]);

  if (!ids.length) return <AppPage><StateView title="السلة فارغة" message="أضف منتجاً قبل إتمام الطلب." actionLabel="تصفح المنتجات" onAction={() => router.replace('/(app)/(tabs)/catalog')} /></AppPage>;
  if (loadingProducts || profile.isLoading) return <AppPage><StateView loading title="نجهّز فاتورتك" message="نتحقق من الأسعار ومعلومات التوصيل." /></AppPage>;
  if (failedProducts) return <AppPage><StateView title="تعذر تحميل الفاتورة" message="تحقق من الاتصال ثم ارجع إلى السلة وحاول مجدداً." actionLabel="العودة إلى السلة" onAction={() => router.replace('/cart')} /></AppPage>;
  if (profile.isError) return <AppPage><StateView title="تعذر تحميل معلومات التوصيل" message="لم نتمكن من جلب بياناتك لتعبية بيانات التوصيل تلقائياً. تحقق من الاتصال وحاول مرة أخرى." actionLabel="إعادة المحاولة" onAction={() => profile.refetch()} /></AppPage>;

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
    if (!quote.data || quote.isError || quote.isFetching) {
      setError('root', { message: 'انتظر تحديث الفاتورة أو راجع الكود والنقاط.' });
      return;
    }
    try {
      const result = await data.rewards.placeOrder({
        ...rewardCart,
        expectedQuote: quote.data,
        idempotencyKey,
        deliveryAddress: values.deliveryAddress,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        deliveryNotes: values.deliveryNotes,
        deliveryLatitude: profile.data?.defaultLatitude,
        deliveryLongitude: profile.data?.defaultLongitude,
        deliveryGooglePlaceId: profile.data?.defaultGooglePlaceId,
        items: ids.map((productId) => ({ productId, quantity: items[productId] ?? 1 })),
        bundleIds: bundles.map((bundle) => bundle.id),
      });
      void queryClient.invalidateQueries({ queryKey: ['reward-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      clear();
      router.replace({ pathname: '/order-success', params: result });
      showToast('تم إرسال طلبك بنجاح', { actionLabel: 'عرض التفاصيل', onAction: () => router.push({ pathname: '/order/[id]', params: { id: result.orderId } }) });
    } catch (error) {
      void quote.refetch();
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
        <View style={styles.invoiceLines}>{bundles.map((bundle) => <View key={bundle.id} style={styles.invoiceLine}><View style={styles.lineCopy}><AppText variant="small" style={styles.semibold}>{bundle.label}</AppText><AppText variant="caption" color={colors.textMuted}>{bundle.items.map((item) => products.find((product) => product.id === item.productId)?.nameAr ?? '...').join('، ')}</AppText></View><AppText variant="small" style={styles.lineTotal}>{formatMoney(bundle.priceSyp)}</AppText></View>)}{looseLines.filter((line) => line.product.price).map(({ product, quantity }) => {
          const unitPrice = product.price!;
          return <View key={product.id} style={styles.invoiceLine}><View style={styles.lineCopy}><AppText variant="small" style={styles.semibold}>{product.nameAr}</AppText><AppText variant="caption" color={colors.textMuted}>{product.packageLabelAr ?? product.unitLabelAr} · {quantity.toLocaleString('ar-SY')} × {formatMoney(unitPrice)}</AppText></View><AppText variant="small" style={styles.lineTotal}>{formatMoney({ ...unitPrice, amountMinor: unitPrice.amountMinor * quantity })}</AppText></View>;
        })}</View>
        <View style={styles.divider} />
        <View style={styles.invoiceLines}>
          <AppText variant="h3">كود خصم أو نقاط</AppText>
          <Field label="كود صديقك أو كوبون خصم" value={codeDraft} onChangeText={setCodeDraft} autoCapitalize="characters" editable={!isSubmitting} />
          <Button label="تطبيق الكود" variant="outline" disabled={!codeDraft.trim() || isSubmitting} onPress={() => { setCode(codeDraft.trim().toUpperCase()); setPoints(0); }} />
          {code ? <View><AppText variant="small">الكود المختار: {code}</AppText><Button label="إزالة الكود" variant="text" disabled={isSubmitting} onPress={() => { setCode(''); setCodeDraft(''); }} /></View> : null}
          <AppText variant="small" color={colors.textMuted}>{wallet.data ? `رصيدك ${wallet.data.available.toLocaleString('ar-SY')} نقطة. كل نقطة = 0.1% خصم، بسقف ${wallet.data.maxPointsDiscountPercent}% للطلب.` : 'جاري تحميل رصيد النقاط…'}</AppText>
          {wallet.isError ? <Button label="إعادة تحميل رصيد النقاط" variant="text" onPress={() => wallet.refetch()} /> : null}
          <Field label="نقاط بدك تصرفها (اختياري)" value={pointsDraft} onChangeText={setPointsDraft} keyboardType="decimal-pad" editable={!isSubmitting} />
          <Button label="تطبيق النقاط" variant="outline" disabled={isSubmitting || !pointsDraft.trim() || !Number.isFinite(Number(pointsDraft)) || Number(pointsDraft) <= 0 || !wallet.data} onPress={() => { setPoints(Number(pointsDraft)); setCode(''); }} />
          {points > 0 ? <View><AppText variant="small">النقاط المختارة: {points} · الخصم {points / 10}%</AppText><Button label="إلغاء استخدام النقاط" variant="text" disabled={isSubmitting} onPress={() => { setPoints(0); setPointsDraft(''); }} /></View> : null}
          <AppText variant="caption" color={colors.textMuted}>كود واحد أو نقاط لكل طلب. الباقات غير مشمولة بالخصم الإضافي.</AppText>
          {quote.isFetching ? <AppText accessibilityRole="status" color={colors.textMuted}>جاري تحديث الفاتورة…</AppText> : quote.isError ? <View accessibilityRole="alert"><AppText color={colors.error}>{normalizeAppError(quote.error).messageAr}</AppText><Button label="تحديث الفاتورة" variant="text" onPress={() => quote.refetch()} /></View> : quote.data ? <View style={styles.invoiceLines}>
            <AppText>قيمة المنتجات: {formatMoney(quote.data.subtotal)}</AppText>
            <AppText color={colors.successText}>الخصم: {formatMoney(quote.data.discount)}</AppText>
            {quote.data.delivery.amountMinor > 0 ? <AppText>التوصيل: {formatMoney(quote.data.delivery)}</AppText> : null}
            {quote.data.tax.amountMinor > 0 ? <AppText>الضريبة: {formatMoney(quote.data.tax)}</AppText> : null}
            {quote.data.usesRemaining !== null ? <AppText variant="caption">متاح {quote.data.usesRemaining} استخدام لهذا الكود قبل هالطلب.</AppText> : null}
          </View> : null}
        </View>
        <View style={styles.totalRow}><AppText variant="h2">{formatMoney(quote.data?.total ?? { amountMinor: subtotal, currency, decimalPlaces })}</AppText><View><AppText variant="small" color={colors.textMuted}>الإجمالي</AppText><AppText variant="caption" color={colors.successText}>الدفع عند الاستلام</AppText></View></View>
        {!canCheckout ? <View accessibilityRole="alert" style={styles.warning}><AppText variant="small" color={colors.warningText}>تغيّر سعر أو توفر أحد المنتجات. ارجع إلى السلة وراجعه.</AppText></View> : null}
        {errors.root?.message ? <View accessibilityRole="alert" style={styles.error}><AppText variant="small" color={colors.error}>{errors.root.message}</AppText></View> : null}
        <Button label="إرسال الطلب" variant="accent" onPress={submit} loading={isSubmitting} disabled={!online || !canCheckout || !quote.data || quote.isError || quote.isFetching} />
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
