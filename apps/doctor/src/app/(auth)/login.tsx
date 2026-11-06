import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Surface } from '@tawreed/ui';
import { emailPasswordSchema, type EmailPasswordInput } from '@tawreed/validation';
import { ar } from '@/locales/ar';
import { useData, useSession } from '@/providers/app-providers';
import { BrandLogo } from '@/components/brand-logo';
import { useToast } from '@/store/toast';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = ['/checkout', '/orders', '/account', '/notifications', '/support'].includes(params.returnTo ?? '') ? params.returnTo! : '/(app)/(tabs)';
  const data = useData();
  const { authNotice, clearAuthNotice } = useSession();
  const showToast = useToast((state) => state.show);
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<EmailPasswordInput>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    if (!data) return;
    try {
      await data.auth.signInWithPassword(values.email, values.password);
      clearAuthNotice();
      router.replace(returnTo as never);
      showToast('تم تسجيل الدخول');
    } catch (error) {
      setError('root', { message: normalizeAppError(error).messageAr });
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <BrandLogo variant="horizontal" width={150} />
          <AppText variant="small" color={colors.primary}>احتياجك، واصل لعندك.</AppText>
        </View>
        <Surface style={styles.card}>
          <AppText variant="h2">{ar.login}</AppText>
          <AppText color={colors.textMuted}>أدخل بيانات حسابك للمتابعة.</AppText>
          {authNotice ? <View accessibilityRole="alert" style={styles.sessionNotice}><AppText variant="small" color={colors.warningText}>{authNotice}</AppText></View> : null}
          <Controller control={control} name="email" render={({ field }) => <Field label={ar.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />} />
          <Controller control={control} name="password" render={({ field }) => <Field label={ar.password} secureTextEntry autoComplete="current-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />} />
          {errors.root?.message ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <AppText color={colors.error}>{errors.root.message}</AppText>
              <Link href="/(auth)/forgot" style={styles.link}>{ar.forgotPassword}</Link>
            </View>
          ) : null}
          <Button label={ar.login} onPress={submit} loading={isSubmitting} />
          <Button label="متابعة تصفح المنتجات كزائر" variant="quiet" onPress={() => router.replace('/(app)/(tabs)/catalog')} />
          {!errors.root?.message ? <Link href="/(auth)/forgot" style={styles.link}>{ar.forgotPassword}</Link> : null}
          <View style={styles.inline}>
            <AppText variant="small" color={colors.textMuted}>{ar.noAccount}</AppText>
            <Link href={{ pathname: '/(auth)/register', params: { returnTo } }} style={styles.link}> {ar.register}</Link>
          </View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.backgroundSubtle },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  card: { width: '100%', maxWidth: 480, gap: spacing.md },
  sessionNotice: { backgroundColor: colors.warningSoft, borderColor: colors.warning, borderWidth: 1, borderRadius: 12, padding: spacing.md },
  errorBox: { gap: spacing.xs },
  link: { color: colors.primary, textAlign: 'center', minHeight: 44, paddingVertical: spacing.sm },
  inline: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center' },
});
