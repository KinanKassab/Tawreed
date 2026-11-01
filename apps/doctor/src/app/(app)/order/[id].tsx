import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { formatMoney, formatNumber, getOrderStatusLabel, type DoctorOrderStatus } from '@tawreed/domain';
import { AppText, Icon, OrdersSkeleton, StateView, Surface } from '@tawreed/ui';
import { AppPage } from '@/components/app-page';
import { useData, useSession } from '@/providers/app-providers';

const steps: DoctorOrderStatus[] = ['received', 'sourcing', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered'];

export default function OrderDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const data = useData();
  const { session } = useSession();
  const order = useQuery({ queryKey: ['orders', session?.user.id, id], queryFn: () => data!.orders.getMineById(id), enabled: Boolean(data && session && id) });
  if (order.isLoading) return <AppPage><OrdersSkeleton /></AppPage>;
  if (!order.data) return <AppPage><StateView title="الطلب غير موجود" message="لا يمكن عرض هذا الطلب أو أنه لا ينتمي إلى حسابك." /></AppPage>;

  const current = order.data.status;
  const currentIndex = steps.indexOf(current);
  const exceptional = current === 'cancelled' || current === 'problem';
  return (
    <AppPage>
      <View style={styles.heading}>
        <AppText variant="small" color={exceptional ? colors.error : colors.primary}>{getOrderStatusLabel(current)}</AppText>
        <AppText variant="h1">طلب <AppText variant="h1" style={styles.ltr}>#{order.data.orderNumber}</AppText></AppText>
      </View>
      <View style={styles.layout}>
        <Surface style={styles.section}>
          <AppText variant="h2">تتبع الطلب</AppText>
          {exceptional ? <AppText color={colors.error}>{getOrderStatusLabel(current)}</AppText> : (
            <View style={styles.timeline}>
              {steps.map((step, index) => {
                const done = index < currentIndex;
                const active = index === currentIndex;
                return (
                  <View key={step} style={styles.step}>
                    {index < steps.length - 1 ? <View style={[styles.connector, done && styles.connectorDone]} /> : null}
                    <View style={[styles.dot, done && styles.dotDone, active && styles.dotCurrent]}>
                      {done ? <Icon name="check" size={15} color={colors.onPrimary} /> : null}
                    </View>
                    <View style={styles.stepCopy}>
                      <AppText variant="body" color={done || active ? colors.text : colors.textMuted}>{getOrderStatusLabel(step)}</AppText>
                      {active ? <AppText variant="caption" color={colors.warningText}>الحالة الحالية</AppText> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Surface>
        <Surface style={styles.section}>
          <AppText variant="h2">المنتجات</AppText>
          {order.data.items.map((item) => <View key={item.id} style={styles.row}><AppText>{formatMoney(item.lineTotal)}</AppText><View><AppText>{item.nameAr}</AppText><AppText variant="caption" color={colors.textMuted}>{formatNumber(item.quantity)} × {formatMoney(item.unitPrice)}</AppText></View></View>)}
          <View style={styles.total}><AppText variant="h3" color={colors.primary}>{formatMoney(order.data.total)}</AppText><AppText variant="h3">الإجمالي</AppText></View>
        </Surface>
      </View>
      <Surface style={styles.section}><AppText variant="h2">التوصيل</AppText><AppText>{order.data.recipientName} · <AppText style={styles.ltr}>{order.data.recipientPhone}</AppText></AppText><AppText color={colors.textMuted}>{order.data.deliveryAddress}</AppText>{order.data.deliveryNotes ? <AppText color={colors.textMuted}>{order.data.deliveryNotes}</AppText> : null}</Surface>
    </AppPage>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs, alignItems: 'flex-end' },
  ltr: { writingDirection: 'ltr' },
  layout: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xl, alignItems: 'flex-start' },
  section: { flex: 1, minWidth: 300, gap: spacing.md },
  timeline: { gap: 0 },
  step: { minHeight: 68, flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md, position: 'relative' },
  connector: { position: 'absolute', top: 24, bottom: -8, insetInlineStart: 11, width: 2, backgroundColor: colors.border },
  connectorDone: { backgroundColor: colors.primary },
  dot: { zIndex: 1, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotCurrent: { backgroundColor: colors.accent, borderColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  stepCopy: { gap: spacing.xxs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  total: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm },
});
