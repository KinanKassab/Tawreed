import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AppText, Button, StateView, Surface } from '@tawreed/ui';
import { AppPage } from '@/components/app-page';
import { useData, useSession } from '@/providers/app-providers';

const number = (value: number) => value.toLocaleString('ar-SY', { maximumFractionDigits: 3 });
export default function RewardsScreen() {
  const data = useData(); const { session } = useSession();
  const [message, setMessage] = useState('');
  const wallet = useQuery({ queryKey: ['reward-wallet', session?.user.id], queryFn: () => data!.rewards.wallet(), enabled: Boolean(data && session), refetchOnWindowFocus: true });
  const shareCode = async () => {
    if (!wallet.data) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(wallet.data.code); setMessage('تم نسخ كودك.'); }
      else { await Share.share({ message: `استخدم كودي ${wallet.data.code} عند طلبك من توريد لتحصل على خصم.` }); }
    } catch { setMessage('يمكنك تحديد الكود ونسخه مباشرة.'); }
  };
  if (wallet.isPending) return <AppPage><StateView loading title="جاري تحميل نقاطك" message="نراجع رصيدك وسجل النقاط." /></AppPage>;
  if (wallet.isError || !wallet.data) return <AppPage><StateView title="تعذر تحميل النقاط" message={normalizeAppError(wallet.error).messageAr} actionLabel="إعادة المحاولة" onAction={() => wallet.refetch()} /></AppPage>;
  return <AppPage>
    <AppText variant="h1">كودي ونقاطي</AppText>
    <Surface style={styles.card}><AppText variant="h2">شارك كودك مع رفقاتك</AppText><AppText selectable variant="h3" color={colors.primary}>{wallet.data.code}</AppText><AppText color={colors.textMuted}>كل رفيق بيقدر يستخدم كودك مرتين. بياخد خصم، وإنت بتجمع نقاط بنسبة 10% من صافي قيمة منتجات طلبه بالدولار.</AppText><Button label={Platform.OS === 'web' ? 'نسخ الكود' : 'مشاركة الكود'} onPress={shareCode} />{message ? <AppText accessibilityRole="alert">{message}</AppText> : null}</Surface>
    <View style={styles.row}><Surface style={[styles.card, styles.grow]}><AppText color={colors.textMuted}>نقاط متاحة</AppText><AppText variant="h1">{number(wallet.data.available)}</AppText><AppText>تعادل خصم {number(wallet.data.available / 10)}%</AppText></Surface><Surface style={[styles.card, styles.grow]}><AppText color={colors.textMuted}>نقاط معلّقة</AppText><AppText variant="h1">{number(wallet.data.pending)}</AppText><AppText variant="small">بتصير متاحة بعد التسليم وتأكيد التحصيل.</AppText></Surface></View>
    <AppText color={colors.textMuted}>كل نقطة = 0.1% خصم. سقف الخصم للطلب {number(wallet.data.maxPointsDiscountPercent)}% على المنتجات المشمولة، مع استثناء الباقات. بتختار بين الكود أو صرف النقاط عند إتمام الطلب.</AppText>
    <Surface style={styles.card}><AppText variant="h2">سجل النقاط</AppText><Button label="تحديث الرصيد" variant="text" onPress={() => wallet.refetch()} loading={wallet.isFetching} />{!wallet.data.history.length ? <AppText color={colors.textMuted}>شارك كودك لتبدأ تجميع النقاط.</AppText> : wallet.data.history.map((entry) => <View key={entry.id} style={styles.history}><AppText>{entry.kind === 'earned' ? 'نقاط مكتسبة' : 'نقاط مستخدمة'} · {number(entry.points)}</AppText><AppText variant="small" color={colors.textMuted}>{entry.orderNumber} · {({ pending: 'معلّقة', available: 'مكتملة', cancelled: 'ملغاة' })[entry.state]}</AppText><AppText variant="caption" color={colors.textMuted}>{new Date(entry.createdAt).toLocaleString('ar-SY', { timeZone: 'Asia/Riyadh' })}</AppText></View>)}</Surface>
  </AppPage>;
}
const styles = StyleSheet.create({ card: { gap: spacing.md }, row: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md }, grow: { flexGrow: 1, flexBasis: 180 }, history: { gap: spacing.xs, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.md } });
