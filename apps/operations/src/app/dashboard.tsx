import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { z } from 'zod';
import { colors, layout, radius, spacing, typography } from '@tawreed/design-tokens';
import { formatMoney, getOrderStatusLabel, normalizeAppError, type DoctorOrderStatus, type OperationsProduct } from '@tawreed/domain';
import { AppText, Button, Field, StateView, Surface } from '@tawreed/ui';
import { ProductManagement } from '@/components/product-management';
import { useData, useSession } from '@/providers/app-providers';

type Section = 'overview' | 'orders' | 'catalog' | 'inventory' | 'settings';
const sections: { id: Section; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: 'view-dashboard-outline' },
  { id: 'orders', label: 'الطلبات', icon: 'clipboard-text-outline' },
  { id: 'catalog', label: 'الكتالوج والأسعار', icon: 'package-variant-closed' },
  { id: 'inventory', label: 'المخزون', icon: 'warehouse' },
  { id: 'settings', label: 'سعر الصرف', icon: 'currency-usd' },
];
const rankLabels = { operations_manager: 'مدير العمليات', admin: 'مدير النظام', owner: 'المالك' } as const;
const inventorySchema = z.object({ delta: z.string().trim().refine((value) => Number.isInteger(Number(value)) && Number(value) !== 0, 'أدخل عدداً صحيحاً غير الصفر.'), notes: z.string().trim().min(3, 'اكتب سبب التعديل.') });
const rateSchema = z.object({ rate: z.string().trim().refine((value) => Number(value) > 0, 'أدخل سعر صرف أكبر من الصفر.') });
type InventoryInput = z.infer<typeof inventorySchema>;
type RateInput = z.infer<typeof rateSchema>;

export default function DashboardScreen() {
  const data = useData();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const [section, setSection] = useState<Section>('overview');
  const [selectedProduct, setSelectedProduct] = useState<OperationsProduct | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const context = useQuery({ queryKey: ['operations-context', session?.user.id], queryFn: () => data!.operations.getMyContext(), enabled: Boolean(data && session) });
  const orders = useQuery({ queryKey: ['operations-orders'], queryFn: () => data!.operations.listOrders(), enabled: Boolean(data && context.data) });
  const products = useQuery({ queryKey: ['operations-products'], queryFn: () => data!.operations.listProducts(), enabled: Boolean(data && context.data) });
  const exchangeRate = useQuery({ queryKey: ['operations-exchange-rate'], queryFn: () => data!.operations.getActiveExchangeRate(), enabled: Boolean(data && context.data) });

  useEffect(() => {
    if (!context.isLoading && !context.data && session) data?.auth.signOut().finally(() => router.replace('/login'));
  }, [context.data, context.isLoading, data, session]);

  const inventoryForm = useForm<InventoryInput>({ resolver: zodResolver(inventorySchema), defaultValues: { delta: '', notes: '' } });
  const rateForm = useForm<RateInput>({ resolver: zodResolver(rateSchema), defaultValues: { rate: '' } });
  useEffect(() => {
    inventoryForm.reset({ delta: '', notes: '' });
  }, [selectedProduct, inventoryForm]);
  useEffect(() => { if (exchangeRate.data) rateForm.reset({ rate: String(exchangeRate.data.rate) }); }, [exchangeRate.data, rateForm]);

  const refreshProducts = () => queryClient.invalidateQueries({ queryKey: ['operations-products'] });
  const inventoryMutation = useMutation({ mutationFn: async (values: InventoryInput) => {
    if (!selectedProduct || !data) return;
    await data.operations.adjustInventory({ productId: selectedProduct.id, quantityDelta: Number(values.delta), notes: values.notes });
  }, onSuccess: async () => { await refreshProducts(); inventoryForm.reset({ delta: '', notes: '' }); setFeedback({ message: 'تم تعديل المخزون وتسجيل الحركة.', error: false }); }, onError: (error) => setFeedback({ message: normalizeAppError(error).messageAr, error: true }) });
  const rateMutation = useMutation({ mutationFn: async (values: RateInput) => {
    if (!data) return;
    await data.operations.setExchangeRate({ baseCurrency: 'USD', quoteCurrency: 'NEW_SYP', rate: Number(values.rate) });
  }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['operations-exchange-rate'] }); setFeedback({ message: 'تم تحديث سعر الصرف وتسجيل التعديل.', error: false }); }, onError: (error) => setFeedback({ message: normalizeAppError(error).messageAr, error: true }) });
  const orderMutation = useMutation({ mutationFn: async ({ id, status }: { id: string; status?: DoctorOrderStatus }) => {
    if (!data) return;
    if (!status) await data.operations.confirmOrder(id);
    else await data.operations.setOrderStatus(id, status);
  }, onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['operations-orders'] }), refreshProducts()]); setFeedback({ message: 'تم تحديث الطلب بنجاح.', error: false }); }, onError: (error) => setFeedback({ message: normalizeAppError(error).messageAr, error: true }) });

  const stats = useMemo(() => {
    const orderRows = orders.data ?? [];
    const productRows = products.data ?? [];
    return {
      newOrders: orderRows.filter((order) => order.status === 'received').length,
      preparing: orderRows.filter((order) => ['preparing', 'ready_for_delivery'].includes(order.status)).length,
      problems: orderRows.filter((order) => order.status === 'problem').length,
      lowStock: productRows.filter((product) => product.onHand - product.reserved <= product.lowStockThreshold).length,
    };
  }, [orders.data, products.data]);
  const filteredProducts = useMemo(() => {
    const needle = productSearch.trim().toLocaleLowerCase('ar');
    if (!needle) return products.data ?? [];
    return (products.data ?? []).filter((product) => `${product.nameAr} ${product.sku}`.toLocaleLowerCase('ar').includes(needle));
  }, [productSearch, products.data]);

  if (!data || context.isLoading || !context.data) return <StateView loading title="جاري التحقق" message="نتحقق من صلاحيات حساب الفريق." />;

  const nextStatus = (status: DoctorOrderStatus): DoctorOrderStatus | undefined => status === 'preparing' ? 'ready_for_delivery' : status === 'ready_for_delivery' ? 'out_for_delivery' : status === 'out_for_delivery' ? 'delivered' : undefined;
  const nextLabel = (status: DoctorOrderStatus) => status === 'preparing' ? 'جاهز للتوصيل' : status === 'ready_for_delivery' ? 'خرج للتوصيل' : status === 'out_for_delivery' ? 'تم التسليم' : '';

  return <View style={[styles.shell, compact && styles.shellCompact]}><View style={[styles.sidebar, compact && styles.sidebarCompact]}><View style={[styles.logo, compact && styles.logoCompact]}><View><AppText variant="h2" color={colors.white}>توريد</AppText><AppText variant="caption" color={colors.mint}>لوحة العمليات</AppText></View>{compact ? <View style={styles.mobileAccount}><AppText variant="caption" color={colors.mint}>{rankLabels[context.data.rank]}</AppText><Pressable accessibilityRole="button" onPress={() => data.auth.signOut().finally(() => router.replace('/login'))} style={styles.logout}><MaterialCommunityIcons name="logout" size={18} color={colors.white} /><AppText variant="caption" color={colors.white}>خروج</AppText></Pressable></View> : null}</View><View accessibilityRole="tablist" style={[styles.nav, compact && styles.navCompact]}>{sections.map((item) => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: section === item.id }} onPress={() => setSection(item.id)} style={({ pressed }) => [styles.navItem, compact && styles.navItemCompact, section === item.id && styles.navItemActive, pressed && styles.pressed]}><MaterialCommunityIcons name={item.icon} size={21} color={section === item.id ? colors.deep : colors.mint} /><AppText variant="small" color={section === item.id ? colors.deep : colors.white}>{item.label}</AppText></Pressable>)}</View>{!compact ? <View style={styles.account}><AppText variant="small" color={colors.white}>{rankLabels[context.data.rank]}</AppText><AppText variant="caption" color={colors.mint} numberOfLines={1}>{session?.user.email}</AppText><Pressable accessibilityRole="button" onPress={() => data.auth.signOut().finally(() => router.replace('/login'))} style={styles.logout}><MaterialCommunityIcons name="logout" size={18} color={colors.white} /><AppText variant="caption" color={colors.white}>تسجيل الخروج</AppText></Pressable></View> : null}</View><ScrollView style={styles.content} contentContainerStyle={styles.contentInner}><View style={styles.pageHeader}><View><AppText variant="h1">{sections.find((item) => item.id === section)?.label}</AppText><AppText color={colors.muted}>إدارة يوم توريد من مكان واحد.</AppText></View>{feedback ? <View accessibilityRole="alert" style={[styles.feedback, feedback.error && styles.feedbackError]}><AppText variant="small" color={feedback.error ? colors.danger : colors.successText}>{feedback.message}</AppText><Pressable accessibilityLabel="إغلاق الرسالة" onPress={() => setFeedback(null)}><MaterialCommunityIcons name="close" size={20} color={feedback.error ? colors.danger : colors.successText} /></Pressable></View> : null}</View>

  {section === 'overview' ? <View style={styles.pageBody}><View style={styles.stats}><Stat label="طلبات جديدة" value={stats.newOrders} icon="clipboard-alert-outline" /><Stat label="قيد التجهيز" value={stats.preparing} icon="progress-clock" /><Stat label="بحاجة متابعة" value={stats.problems} icon="alert-circle-outline" /><Stat label="مخزون منخفض" value={stats.lowStock} icon="package-variant-minus" /></View><Surface style={styles.panel}><AppText variant="h3">أولوية اليوم</AppText><AppText color={colors.muted}>ابدأ بتأكيد الطلبات الجديدة. لن يُحجز أي مخزون قبل التأكيد، ولن يُصرف إلا كامل الطلب عند خروجه للتوصيل.</AppText><Button label="عرض الطلبات" onPress={() => setSection('orders')} style={styles.shortButton} /></Surface></View> : null}

  {section === 'orders' ? <View style={styles.pageBody}>{orders.isLoading ? <StateView loading title="جاري تحميل الطلبات" message="لحظات قليلة." /> : orders.data?.length ? orders.data.map((order) => <Surface key={order.id} style={styles.orderCard}><View style={styles.rowWrap}><View style={styles.grow}><AppText variant="h3">طلب {order.orderNumber}</AppText><AppText variant="small" color={colors.muted}>{order.recipientName} · {order.recipientPhone}</AppText></View><StatusBadge label={getOrderStatusLabel(order.status)} problem={order.status === 'problem'} /></View><View style={styles.metaGrid}><Meta label="التاريخ" value={new Date(order.createdAt).toLocaleString('ar-SY')} /><Meta label="العناصر" value={order.itemCount.toLocaleString('ar-SY')} /><Meta label="الإجمالي" value={formatMoney(order.total)} /><Meta label="العنوان" value={order.deliveryAddress} /></View><View style={styles.actions}>{['received', 'problem'].includes(order.status) ? <Button label="تأكيد الطلب وحجزه" onPress={() => orderMutation.mutate({ id: order.id })} loading={orderMutation.isPending} /> : null}{nextStatus(order.status) ? <Button label={nextLabel(order.status)} onPress={() => orderMutation.mutate({ id: order.id, status: nextStatus(order.status) })} loading={orderMutation.isPending} /> : null}{['preparing', 'ready_for_delivery', 'problem'].includes(order.status) ? <Button label="إلغاء الطلب وفك الحجز" variant="secondary" onPress={() => orderMutation.mutate({ id: order.id, status: 'cancelled' })} loading={orderMutation.isPending} /> : null}</View></Surface>) : <StateView title="لا توجد طلبات" message="ستظهر طلبات الأطباء الجديدة هنا." />}</View> : null}

  {section === 'catalog' ? <ProductManagement products={filteredProducts} loading={products.isLoading} compact={compact} search={productSearch} onSearch={setProductSearch} onRefresh={refreshProducts} onFeedback={(message, error = false) => setFeedback({ message, error })} /> : null}

  {section === 'inventory' ? <View style={[styles.split, compact && styles.splitCompact]}><View style={styles.listPane}><Field label="بحث بالاسم أو SKU" value={productSearch} onChangeText={setProductSearch} />{filteredProducts.map((product) => <ProductRow key={product.id} product={product} selected={selectedProduct?.id === product.id} onPress={() => setSelectedProduct(product)} showStock />)}</View><Surface style={styles.editor}>{selectedProduct ? <><AppText variant="h3">{selectedProduct.nameAr}</AppText><View style={styles.stockSummary}><Meta label="الموجود" value={selectedProduct.onHand.toLocaleString('ar-SY')} /><Meta label="المحجوز" value={selectedProduct.reserved.toLocaleString('ar-SY')} /><Meta label="المتاح" value={(selectedProduct.onHand - selectedProduct.reserved).toLocaleString('ar-SY')} /></View><Controller control={inventoryForm.control} name="delta" render={({ field }) => <Field label="كمية التعديل (+ أو -)" keyboardType="numbers-and-punctuation" value={field.value} onChangeText={field.onChange} error={inventoryForm.formState.errors.delta?.message} />} /><Controller control={inventoryForm.control} name="notes" render={({ field }) => <Field label="سبب التعديل" value={field.value} onChangeText={field.onChange} error={inventoryForm.formState.errors.notes?.message} />} /><Button label="تسجيل حركة المخزون" onPress={inventoryForm.handleSubmit((values) => inventoryMutation.mutate(values))} loading={inventoryMutation.isPending} /></> : <AppText color={colors.muted}>اختر منتجاً لتعديل مخزونه.</AppText>}</Surface></View> : null}

  {section === 'settings' ? <Surface style={styles.settingsCard}><AppText variant="h3">سعر الصرف التشغيلي</AppText><AppText color={colors.muted}>يُستخدم السعر الجديد للطلبات اللاحقة فقط؛ الطلبات السابقة تحتفظ بنسختها المالية.</AppText><Controller control={rateForm.control} name="rate" render={({ field }) => <Field label="كل 1 USD يساوي" keyboardType="decimal-pad" value={field.value} onChangeText={field.onChange} error={rateForm.formState.errors.rate?.message} />} /><AppText variant="small" color={colors.muted}>ليرة سورية جديدة</AppText><Button label="حفظ سعر الصرف" onPress={rateForm.handleSubmit((values) => rateMutation.mutate(values))} loading={rateMutation.isPending} /></Surface> : null}
  </ScrollView></View>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }) { return <Surface style={styles.stat}><View style={styles.statIcon}><MaterialCommunityIcons name={icon} size={22} color={colors.ink} /></View><AppText variant="h2">{value.toLocaleString('ar-SY')}</AppText><AppText variant="small" color={colors.muted}>{label}</AppText></Surface>; }
function StatusBadge({ label, problem = false }: { label: string; problem?: boolean }) { return <View style={[styles.badge, problem && styles.badgeProblem]}><AppText variant="caption" color={problem ? colors.danger : colors.successText}>{label}</AppText></View>; }
function Meta({ label, value }: { label: string; value: string }) { return <View style={styles.meta}><AppText variant="caption" color={colors.muted}>{label}</AppText><AppText variant="small">{value}</AppText></View>; }
function ProductRow({ product, selected, onPress, showStock = false }: { product: OperationsProduct; selected: boolean; onPress: () => void; showStock?: boolean }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.productRow, selected && styles.productRowSelected, pressed && styles.pressed]}><View style={styles.grow}><AppText variant="body" style={styles.semibold}>{product.nameAr}</AppText><AppText variant="caption" color={colors.muted}>{product.sku}</AppText></View><View style={styles.productEnd}>{showStock ? <AppText variant="small">متاح {(product.onHand - product.reserved).toLocaleString('ar-SY')}</AppText> : <AppText variant="small">{product.price ? formatMoney(product.price) : 'بلا سعر'}</AppText>}<MaterialCommunityIcons name="chevron-left" size={20} color={colors.muted} /></View></Pressable>; }

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row-reverse', backgroundColor: colors.soft }, shellCompact: { flexDirection: 'column' },
  sidebar: { width: 260, backgroundColor: colors.deep, padding: spacing.lg, gap: spacing.xl, justifyContent: 'space-between' }, sidebarCompact: { width: '100%', padding: spacing.md, gap: spacing.md, flexShrink: 0, zIndex: 2 },
  logo: { gap: 2 }, logoCompact: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }, mobileAccount: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm }, nav: { gap: spacing.xs, flex: 1 }, navCompact: { flexDirection: 'row-reverse', flexWrap: 'wrap', flex: 0, width: '100%' },
  navItem: { minHeight: 46, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md }, navItemCompact: { flexBasis: 150, flexGrow: 1 }, navItemActive: { backgroundColor: colors.pale },
  account: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.green, paddingTop: spacing.md }, logout: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs },
  content: { flex: 1, minHeight: 0, zIndex: 1 }, contentInner: { width: '100%', maxWidth: layout.contentMax, alignSelf: 'center', padding: spacing.xl, gap: spacing.xl },
  pageHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, pageBody: { gap: spacing.md },
  feedback: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successSurface, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 44 }, feedbackError: { backgroundColor: '#F5E9E7' },
  stats: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md }, stat: { flexGrow: 1, flexBasis: 180, gap: spacing.xs }, statIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  panel: { gap: spacing.md }, shortButton: { alignSelf: 'flex-end', minWidth: 180 }, orderCard: { gap: spacing.md }, rowWrap: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }, grow: { flex: 1, minWidth: 0, gap: 2 },
  badge: { backgroundColor: colors.successSurface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, badgeProblem: { backgroundColor: '#F5E9E7' },
  metaGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md }, meta: { minWidth: 130, flexGrow: 1, gap: 2 }, actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  split: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.lg }, splitCompact: { flexDirection: 'column' }, listPane: { flex: 1, width: '100%', gap: spacing.xs }, editor: { width: 360, maxWidth: '100%', gap: spacing.md },
  productRow: { minHeight: 66, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white }, productRowSelected: { borderColor: colors.green, backgroundColor: colors.pale }, productEnd: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs },
  stockSummary: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.pale, borderRadius: radius.md, padding: spacing.md }, settingsCard: { maxWidth: 560, width: '100%', gap: spacing.md },
  semibold: { fontFamily: typography.family.semibold, fontWeight: '600' }, pressed: { opacity: 0.76 },
});
