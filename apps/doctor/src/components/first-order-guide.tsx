import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { AppText, Button, Icon, Surface, type IconName } from '@tawreed/ui';
import { useData, useSession } from '@/providers/app-providers';

const steps: { icon: IconName; title: string; body: string }[] = [
  { icon: 'view-grid-outline', title: 'تصفّح المنتجات', body: 'استعرض الأقسام أو استخدم البحث لإيجاد ما تحتاجه.' },
  { icon: 'cart-outline', title: 'أضف إلى السلة', body: 'اختر الكمية والخيار المناسب، وراجع السلة قبل الطلب.' },
  { icon: 'clipboard-check-outline', title: 'أكّد الطلب', body: 'راجع الفاتورة ومعلومات التوصيل، ثم أرسل الطلب.' },
];

const dismissedKey = (userId: string) => `tawreed-first-order-guide-dismissed-${userId}`;

export function FirstOrderGuide() {
  const data = useData();
  const { session } = useSession();
  const orders = useQuery({ queryKey: ['orders', session?.user.id], queryFn: () => data!.orders.listMine(), enabled: Boolean(data && session) });
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    AsyncStorage.getItem(dismissedKey(session.user.id)).then((value) => { if (active) setDismissed(value === '1'); });
    return () => { active = false; };
  }, [session]);

  const dismiss = () => {
    setDismissed(true);
    if (session) void AsyncStorage.setItem(dismissedKey(session.user.id), '1');
  };

  const visible = Boolean(session) && orders.data?.length === 0 && dismissed === false;
  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent statusBarTranslucent presentationStyle="overFullScreen" visible onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Surface accessibilityViewIsModal accessibilityLabel="دليل أول طلب" role="dialog" style={styles.card}>
          <AppText variant="h2">أول طلب لك بتوريد؟</AppText>
          <AppText color={colors.textMuted}>ثلاث خطوات بسيطة من التصفّح إلى استلام طلبك.</AppText>
          <View style={styles.steps}>
            {steps.map((step, index) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.stepIcon}><Icon name={step.icon} size={22} color={colors.primary} /></View>
                <View style={styles.stepCopy}><AppText variant="h3">{index + 1}. {step.title}</AppText><AppText variant="small" color={colors.textMuted}>{step.body}</AppText></View>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <Button label="ابدأ التسوق" onPress={() => { dismiss(); router.push('/(app)/(tabs)/catalog'); }} />
            <Button label="تخطي" variant="text" onPress={dismiss} />
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.overlay },
  card: { width: '100%', maxWidth: 440, gap: spacing.md },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.sm },
  stepIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  stepCopy: { flex: 1, gap: 2 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
});
