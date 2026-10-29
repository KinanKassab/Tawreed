import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Surface } from '@tawreed/ui';
import { emailPasswordSchema, type EmailPasswordInput } from '@tawreed/validation';
import { ar } from '@/locales/ar';
import { useData } from '@/providers/app-providers';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = ['/checkout', '/orders', '/account', '/notifications', '/support'].includes(params.returnTo ?? '') ? params.returnTo! : '/(app)/(tabs)';
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const data = useData();
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<EmailPasswordInput>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: { email: '', password: '' },
  });

  const closeAccountSetup = () => setShowAccountSetup(false);
  const openAccountSetup = () => {
    closeAccountSetup();
    router.push({ pathname: '/(auth)/register', params: { returnTo } });
  };
  const submit = handleSubmit(async (values) => {
    if (!data) return;
    closeAccountSetup();
    try {
      await data.auth.signInWithPassword(values.email, values.password);
      router.replace(returnTo as never);
    } catch (error) {
      const normalized = normalizeAppError(error);
      setError('root', { message: normalized.messageAr });
      if (normalized.kind === 'unauthorized') setShowAccountSetup(true);
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <AppText variant="h1">توريد</AppText>
          <AppText variant="small" color={colors.green}>{ar.doctorApp}</AppText>
        </View>
        <Surface style={styles.card}>
          <AppText variant="h2">{ar.login}</AppText>
          <AppText color={colors.muted}>أدخل بيانات حسابك للمتابعة.</AppText>
          <Controller control={control} name="email" render={({ field }) => <Field label={ar.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />} />
          <Controller control={control} name="password" render={({ field }) => <Field label={ar.password} secureTextEntry autoComplete="current-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />} />
          {errors.root?.message ? <AppText accessibilityRole="alert" color={colors.danger}>{errors.root.message}</AppText> : null}
          <Button label={ar.login} onPress={submit} loading={isSubmitting} />
          <Button label="متابعة تصفح المنتجات كزائر" variant="quiet" onPress={() => router.replace('/(app)/(tabs)/catalog')} />
          <Link href="/(auth)/forgot" style={styles.link}>{ar.forgotPassword}</Link>
          <View style={styles.inline}>
            <AppText variant="small" color={colors.muted}>{ar.noAccount}</AppText>
            <Link href={{ pathname: '/(auth)/register', params: { returnTo } }} style={styles.link}> {ar.register}</Link>
          </View>
        </Surface>
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={closeAccountSetup}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={showAccountSetup}>
        <View style={styles.modalBackdrop}>
          <Surface
            accessibilityLabel="خيارات تجهيز الحساب"
            accessibilityViewIsModal
            role="dialog"
            style={styles.accountDialog}>
            <AppText variant="h3">هل تريد تجهيز حساب جديد؟</AppText>
            <AppText color={colors.muted}>إذا لم يكن لديك حساب في توريد، يمكنك تجهيز حسابك الآن والبدء خلال دقائق.</AppText>
            <View style={styles.dialogActions}>
              <Button label="تجهيز حساب جديد" onPress={openAccountSetup} />
              <Button label="ليس الآن" variant="secondary" onPress={closeAccountSetup} />
            </View>
          </Surface>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.soft },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  card: { width: '100%', maxWidth: 480, gap: spacing.md },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.overlay },
  accountDialog: { width: '100%', maxWidth: 440, gap: spacing.md, borderColor: colors.green, elevation: 12, shadowColor: colors.deep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 24 },
  dialogActions: { gap: spacing.sm, marginTop: spacing.xs },
  link: { color: colors.green, textAlign: 'center', minHeight: 44, paddingVertical: spacing.sm },
  inline: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center' },
});
