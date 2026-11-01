import { router } from 'expo-router';
import { Modal, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { AppText, Button, Icon, Surface } from '@tawreed/ui';

type GuestAuthPromptProps = {
  onClose: () => void;
  returnTo: '/orders' | '/account';
  sectionLabel: string;
  visible: boolean;
};

export function GuestAuthPrompt({ onClose, returnTo, sectionLabel, visible }: GuestAuthPromptProps) {
  const continueToLogin = () => {
    onClose();
    router.push({ pathname: '/(auth)/login', params: { returnTo } });
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <Surface
          accessibilityLabel="تسجيل الدخول مطلوب"
          accessibilityViewIsModal
          role="dialog"
          style={styles.dialog}>
          <View style={styles.icon}>
            <Icon name="account-lock-outline" size={30} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <AppText variant="h2" style={styles.center}>سجّل دخولك للمتابعة</AppText>
            <AppText color={colors.textMuted} style={styles.center}>قسم {sectionLabel} مرتبط بحسابك، لذلك يلزم تسجيل الدخول لعرض بياناتك بأمان.</AppText>
          </View>
          <View style={styles.actions}>
            <Button label="تسجيل الدخول" onPress={continueToLogin} />
            <Button label="ليس الآن" variant="quiet" onPress={onClose} />
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
  actions: { gap: spacing.xs },
});
