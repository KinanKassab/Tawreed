import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { formatMoney, normalizeAppError, type DoctorOrderStatus, type RewardCoupon, type RewardTrackingFilters, type StaffRank } from '@tawreed/domain';
import { AppText, Button, Field, StateView, Surface } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';

const states = { pending: 'معلّقة', available: 'مكتملة', cancelled: 'ملغاة' };
const kinds = { friend: 'كود صديق', campaign: 'كوبون عام', points: 'صرف نقاط' };
const orderLabels: Record<DoctorOrderStatus, string> = { received: 'جديد', sourcing: 'تأمين المنتجات', preparing: 'قيد التحضير', ready_for_delivery: 'جاهز للتوصيل', out_for_delivery: 'قيد التوصيل', delivered: 'تم التسليم', cancelled: 'ملغي', problem: 'بحاجة متابعة' };
const statuses: (DoctorOrderStatus | '')[] = ['', 'received', 'sourcing', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'cancelled', 'problem'];
const dateLabel = (value: string) => new Date(value).toLocaleString('ar-SY', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' });
const numberLabel = (value: number) => value.toLocaleString('ar-SY', { maximumFractionDigits: 3 });
function dateBoundary(value: string, end: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('INVALID_DATE');
  return new Date(new Date(`${value}T00:00:00+03:00`).getTime() + (end ? 86400000 : 0)).toISOString();
}
export function RewardManagement({ rank }: { rank: StaffRank }) {
  const data = useData();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterError, setFilterError] = useState('');
  const [filters, setFilters] = useState<RewardTrackingFilters>({ offset: 0 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const tracking = useQuery({ queryKey: ['reward-tracking', filters], queryFn: () => data!.rewards.tracking(filters), enabled: Boolean(data), refetchInterval: 15_000 });
  const collect = useMutation({ mutationFn: (id: string) => data!.rewards.collect(id), onSuccess: () => client.invalidateQueries({ queryKey: ['reward-tracking'] }) });
  const applyFilters = () => {
    try {
      const start = from ? dateBoundary(from, false) : undefined;
      const end = to ? dateBoundary(to, true) : undefined;
      if (start && end && start >= end) throw new Error('INVALID_DATE');
      setFilters((previous) => ({ search: search.trim(), from: start, to: end, status: previous.status, offset: 0 })); setFilterError('');
    } catch { setFilterError('أدخل تاريخاً صحيحاً بصيغة YYYY-MM-DD، والنهاية بعد البداية.'); }
  };
  return <View style={styles.stack}>
    <Surface style={styles.panel}>
      <AppText variant="h2">مين استخدم كود مين؟</AppText>
      <AppText color={colors.textMuted}>طلبات الأكواد وصرف النقاط، مع المشتريات والتاريخ بتوقيت الرياض. النقاط تُتاح بعد الوصول وتأكيد التحصيل.</AppText>
      <Field label="بحث بالمشتري، الهاتف، صاحب الكود، الكود أو رقم الطلب" value={search} onChangeText={setSearch} onSubmitEditing={applyFilters} />
      <View style={styles.row}><View style={styles.grow}><Field label="من تاريخ (YYYY-MM-DD)" value={from} onChangeText={setFrom} placeholder="2026-11-01" /></View><View style={styles.grow}><Field label="إلى تاريخ (YYYY-MM-DD)" value={to} onChangeText={setTo} placeholder="2026-11-30" /></View></View>
      {filterError ? <AppText accessibilityRole="alert" color={colors.error}>{filterError}</AppText> : null}
      <View style={styles.row}><Button label="تطبيق البحث" onPress={applyFilters} /><Button label="مسح الفلاتر" variant="outline" onPress={() => { setSearch(''); setFrom(''); setTo(''); setFilterError(''); setFilters({ offset: 0 }); }} /><Button label="تحديث" variant="text" onPress={() => tracking.refetch()} loading={tracking.isFetching} /></View>
      <View style={styles.row}>{statuses.map((status) => <Button key={status} label={status ? orderLabels[status] : 'كل الحالات'} variant={(filters.status ?? '') === status ? 'primary' : 'outline'} onPress={() => setFilters((previous) => ({ ...previous, status, offset: 0 }))} />)}</View>
    </Surface>
    {tracking.isPending ? <StateView loading title="جاري تحميل المتابعة" message="نحمّل استخدامات الأكواد والنقاط." /> : tracking.isError ? <StateView title="تعذر تحميل السجل" message={normalizeAppError(tracking.error).messageAr} actionLabel="إعادة المحاولة" onAction={() => tracking.refetch()} /> : !tracking.data?.rows.length ? <Surface style={styles.panel}><AppText variant="h3">لا توجد استخدامات مطابقة</AppText><AppText color={colors.textMuted}>ستظهر العمليات بعد إرسال طلب بكود أو استخدام نقاط.</AppText></Surface> : tracking.data.rows.map((row) => <Surface key={row.id} style={styles.panel}>
      <View style={styles.rowBetween}><View style={styles.grow}><AppText variant="h3">{row.orderNumber} · {row.buyerName}</AppText><AppText variant="small" color={colors.textMuted}>{dateLabel(row.createdAt)} · {row.buyerPhone}</AppText></View><AppText color={colors.primary}>{orderLabels[row.status]}</AppText></View>
      <View style={styles.highlight}><AppText>{kinds[row.kind]}{row.code ? `: ${row.code}` : ''}</AppText><AppText>{row.ownerName ? `صاحب الكود: ${row.ownerName}` : row.kind === 'campaign' ? 'كوبون صادر عن الإدارة' : 'خصم من رصيد المشتري'}</AppText></View>
      <View style={styles.row}><Metric label="قيمة الطلب النهائية" value={formatMoney(row.total)} /><Metric label="الخصم" value={formatMoney(row.discount)} /><Metric label="نقاط لصاحب الكود" value={numberLabel(row.pointsEarned)} /><Metric label="نقاط مصروفة" value={numberLabel(row.pointsSpent)} /><Metric label="حالة العملية" value={states[row.rewardState]} /></View>
      <AppText variant="small" color={colors.textMuted}>{row.collectedAt ? `تم تأكيد التحصيل: ${dateLabel(row.collectedAt)}` : 'لم يُؤكد التحصيل بعد'}</AppText>
      <Button label={expanded === row.id ? 'إخفاء المشتريات' : `عرض المشتريات (${row.items.length})`} variant="text" onPress={() => setExpanded(expanded === row.id ? null : row.id)} />
      {expanded === row.id ? <View style={styles.highlight}>{row.items.map((item, index) => <View key={`${item.sku}-${index}`} style={styles.rowBetween}><View style={styles.grow}><AppText>{item.name}</AppText><AppText variant="caption" color={colors.textMuted}>{item.sku} · الكمية: {numberLabel(item.quantity)}</AppText></View><AppText>{formatMoney(item.total)}</AppText></View>)}<AppText variant="caption" color={colors.textMuted}>قيم المنتجات قبل خصم الكود أو النقاط. المبلغ النهائي ظاهر أعلاه.</AppText></View> : null}
      {row.status === 'delivered' && !row.collectedAt ? <Button label="تأكيد تحصيل قيمة الطلب وإتاحة النقاط" variant="outline" loading={collect.isPending && collect.variables === row.orderId} disabled={collect.isPending} onPress={() => collect.mutate(row.orderId)} /> : null}
    </Surface>)}
    {collect.error ? <AppText accessibilityRole="alert" color={colors.error}>{normalizeAppError(collect.error).messageAr}</AppText> : null}
    <View style={styles.row}><Button label="السابق" variant="outline" disabled={!filters.offset || tracking.isFetching} onPress={() => setFilters((previous) => ({ ...previous, offset: Math.max(0, (previous.offset ?? 0) - 50) }))} /><AppText>صفحة {Math.floor((filters.offset ?? 0) / 50) + 1}</AppText><Button label="التالي" variant="outline" disabled={!tracking.data?.hasMore || tracking.isFetching || tracking.isError} onPress={() => setFilters((previous) => ({ ...previous, offset: (previous.offset ?? 0) + 50 }))} /></View>
    {rank !== 'operations_manager' ? <RewardConfiguration /> : null}
  </View>;
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><AppText variant="caption" color={colors.textMuted}>{label}</AppText><AppText>{value}</AppText></View>; }
function RewardConfiguration() {
  const data = useData();
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ['reward-settings'], queryFn: () => data!.rewards.settings() });
  const coupons = useQuery({ queryKey: ['reward-coupons'], queryFn: () => data!.rewards.coupons() });
  const [friend, setFriend] = useState(''); const [cap, setCap] = useState('');
  const [code, setCode] = useState(''); const [value, setValue] = useState('');
  const [type, setType] = useState<RewardCoupon['type']>('percent'); const [expiry, setExpiry] = useState(''); const [uses, setUses] = useState('2');
  const [error, setError] = useState('');
  const save = useMutation({ mutationFn: () => data!.rewards.saveSettings({ friendDiscountPercent: Number(friend || settings.data?.friendDiscountPercent), maxPointsDiscountPercent: Number(cap || settings.data?.maxPointsDiscountPercent) }), onSuccess: () => client.invalidateQueries({ queryKey: ['reward-settings'] }) });
  const coupon = useMutation({ mutationFn: (input: RewardCoupon) => data!.rewards.saveCoupon(input), onSuccess: () => client.invalidateQueries({ queryKey: ['reward-coupons'] }) });
  const createCoupon = () => {
    try {
      if (!/^[A-Z0-9-]{4,40}$/.test(code.toUpperCase()) || !Number.isFinite(Number(value)) || Number(value) <= 0 || (type === 'percent' && Number(value) > 100) || !Number.isInteger(Number(uses)) || Number(uses) < 1 || Number(uses) > 1000) throw new Error();
      const expiresAt = expiry ? dateBoundary(expiry, true) : null; setError('');
      coupon.mutate({ code: code.toUpperCase(), type, value: Number(value), active: true, expiresAt, maxUsesPerUser: Number(uses) });
    } catch { setError('راجع الكود والقيمة والتاريخ وحد الاستخدام. الكود 4–40 حرفاً إنجليزياً أو رقماً أو شرطة.'); }
  };
  return <Surface style={styles.panel}>
    <AppText variant="h2">إعدادات الكوبونات والنقاط</AppText><AppText color={colors.textMuted}>كسب النقاط: 10% من صافي المنتجات بالدولار. كل نقطة = 0.1% خصم. كود الصديق مرتان لكل شخص. الباقات مستثناة من الخصم الإضافي.</AppText>
    {settings.isError ? <AppText color={colors.error}>{normalizeAppError(settings.error).messageAr}</AppText> : <View style={styles.row}><View style={styles.grow}><Field label="خصم كود الصديق (%)" value={friend || String(settings.data?.friendDiscountPercent ?? '')} keyboardType="decimal-pad" onChangeText={setFriend} /></View><View style={styles.grow}><Field label="أقصى خصم بالنقاط (%)" value={cap || String(settings.data?.maxPointsDiscountPercent ?? '')} keyboardType="decimal-pad" onChangeText={setCap} /></View><Button label="حفظ الإعدادات" loading={save.isPending} disabled={!settings.data || ![Number(friend || settings.data.friendDiscountPercent), Number(cap || settings.data.maxPointsDiscountPercent)].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)} onPress={() => save.mutate()} /></View>}
    {save.error ? <AppText color={colors.error}>{normalizeAppError(save.error).messageAr}</AppText> : save.isSuccess ? <AppText color={colors.successText}>تم حفظ الإعدادات للطلبات الجديدة.</AppText> : null}
    <AppText variant="h3">كوبون عام</AppText><Field label="رمز الكوبون" value={code} autoCapitalize="characters" onChangeText={setCode} />
    <View style={styles.row}><Button label="نسبة مئوية" variant={type === 'percent' ? 'primary' : 'outline'} onPress={() => setType('percent')} /><Button label="مبلغ ثابت بالدولار" variant={type === 'fixed' ? 'primary' : 'outline'} onPress={() => setType('fixed')} /></View>
    <View style={styles.row}><View style={styles.grow}><Field label={type === 'percent' ? 'نسبة الخصم (%)' : 'قيمة الخصم بالدولار'} value={value} keyboardType="decimal-pad" onChangeText={setValue} /></View><View style={styles.grow}><Field label="الاستخدامات لكل شخص" value={uses} keyboardType="number-pad" onChangeText={setUses} /></View><View style={styles.grow}><Field label="آخر يوم للصلاحية (YYYY-MM-DD، اختياري)" value={expiry} onChangeText={setExpiry} /></View></View>
    <Button label="حفظ الكوبون" loading={coupon.isPending} onPress={createCoupon} />
    {error || coupon.error ? <AppText accessibilityRole="alert" color={colors.error}>{error || normalizeAppError(coupon.error).messageAr}</AppText> : coupon.isSuccess ? <AppText color={colors.successText}>تم حفظ الكوبون.</AppText> : null}
    {coupons.isError ? <StateView title="تعذر تحميل الكوبونات" message="تحقق من الاتصال وحاول مجدداً." actionLabel="إعادة المحاولة" onAction={() => coupons.refetch()} /> : coupons.data?.map((item) => <View key={item.code} style={styles.rowBetween}><View style={styles.grow}><AppText>{item.code} · {item.value}{item.type === 'percent' ? '%' : '$'} · {item.active ? 'فعّال' : 'متوقف'}</AppText><AppText variant="caption" color={colors.textMuted}>{item.maxUsesPerUser} استخدام لكل شخص{item.expiresAt ? ` · انتهاء: ${dateLabel(item.expiresAt)}` : ''}</AppText></View><Button label={item.active ? 'إيقاف' : 'تفعيل'} variant="outline" disabled={coupon.isPending} onPress={() => coupon.mutate({ ...item, active: !item.active })} /></View>)}
  </Surface>;
}
const styles = StyleSheet.create({
  stack: { gap: spacing.md }, panel: { gap: spacing.md, borderColor: colors.line, borderRadius: radius.md },
  row: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  rowBetween: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  grow: { flexGrow: 1, flexBasis: 220, minWidth: 0, gap: spacing.xs }, metric: { flexGrow: 1, flexBasis: 140, gap: spacing.xs },
  highlight: { backgroundColor: colors.pale, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
