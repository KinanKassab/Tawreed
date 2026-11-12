import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { AppText, Button, Field, Icon, Surface } from '@tawreed/ui';
import { useRequestProduct } from '@/hooks/use-catalog';
import { useToast } from '@/store/toast';

type ProductRequestDialogProps = {
  onClose: () => void;
  searchQuery: string;
  visible: boolean;
};

const NAME_MIN = 2;
const NAME_MAX = 120;

// Asks the team to stock a product search could not find. The request is anonymous by design: the database keeps
// only the product name and the search text (see request_catalog_product), and the dialog says so before sending.
export function ProductRequestDialog({ onClose, searchQuery, visible }: ProductRequestDialogProps) {
  const [name, setName] = useState(searchQuery);
  const [error, setError] = useState<string>();
  const request = useRequestProduct();
  const showToast = useToast((state) => state.show);

  useEffect(() => {
    if (!visible) return;
    setName(searchQuery);
    setError(undefined);
    request.reset();
    // Each opening starts from the latest search; `request` is stable enough to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, searchQuery]);

  const send = () => {
    const productName = name.trim().replace(/\s+/g, ' ');
    if (productName.length < NAME_MIN) { setError('اكتب اسم المنتج اللي بدك ياه.'); return; }
    setError(undefined);
    request.mutate({ productName, searchQuery }, {
      onSuccess: () => { onClose(); showToast('وصل طلبك، شكراً إلك!'); },
      onError: (cause) => {
        const code = (cause as { code?: string }).code;
        setError(code === '54000' ? 'في طلبات كتير هلق، جرّب بعد دقيقة.' : 'ما قدرنا نبعت الطلب. تحقق من الاتصال وجرّب مرة تانية.');
      },
    });
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}>
      <View style={styles.backdrop}>
        <Surface accessibilityLabel="اطلب إضافة منتج" accessibilityViewIsModal role="dialog" style={styles.dialog}>
          <View style={styles.icon}>
            <Icon name="package-variant-closed" size={30} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <AppText variant="h2" style={styles.center}>اطلب إضافة منتج</AppText>
            <AppText color={colors.textMuted} style={styles.center}>اكتب اسم المنتج اللي ما لقيته، ومنشوف إذا فينا نوفّره.</AppText>
          </View>
          <Field
            label="اسم المنتج"
            value={name}
            onChangeText={(text) => { setName(text); if (error) setError(undefined); }}
            maxLength={NAME_MAX}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={send}
            error={error}
          />
          <View accessibilityRole="text" style={styles.privacy}>
            <Icon name="shield-lock-outline" size={20} color={colors.primary} />
            <AppText variant="small" color={colors.textMuted} style={styles.privacyText}>
              الطلب بيوصل لفريق توريد بدون أي شي عنك: ما منسجّل اسمك ولا رقمك ولا حسابك، بس اسم المنتج.
            </AppText>
          </View>
          <View style={styles.actions}>
            <Button label="إرسال الطلب" onPress={send} loading={request.isPending} />
            <Button label="إلغاء" variant="quiet" onPress={onClose} disabled={request.isPending} />
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.overlay },
  dialog: { width: '100%', maxWidth: 420, gap: spacing.lg, borderColor: colors.primary, borderRadius: radius.xl, elevation: 2, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 18 },
  icon: { width: 58, height: 58, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: colors.primarySoft },
  copy: { gap: spacing.xs },
  center: { textAlign: 'center' },
  privacy: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
  privacyText: { flex: 1 },
  actions: { gap: spacing.xs },
});
