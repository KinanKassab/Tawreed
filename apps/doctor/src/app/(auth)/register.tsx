import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Surface } from '@tawreed/ui';
import { registerSchema, type RegisterInput } from '@tawreed/validation';
import { ar } from '@/locales/ar';
import { useData } from '@/providers/app-providers';

export default function RegisterScreen() {
  const data = useData();
  const [notice, setNotice] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', clinicName: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    if (!data) return;
    setNotice(null);
    try {
      const signedIn = await data.auth.signUpWithPassword(values.email, values.password, values.fullName, values.clinicName);
      if (signedIn) {
        router.replace('/(app)/(tabs)');
        return;
      }
      setNotice('تم تجهيز حسابك. افتح رسالة التأكيد في بريدك لإكمال الدخول تلقائياً.');
    } catch (error) {
      setError('root', { message: normalizeAppError(error).messageAr });
    }
  });

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Surface style={styles.card}>
        <AppText variant="h2">تجهيز حساب جديد</AppText>
        <AppText color={colors.muted}>أدخل بياناتك الأساسية لتجهيز حسابك والبدء باستخدام توريد.</AppText>
        <Controller control={control} name="fullName" render={({ field }) => <Field label={ar.fullName} autoComplete="name" value={field.value} onChangeText={field.onChange} error={errors.fullName?.message} />} />
        <Controller control={control} name="clinicName" render={({ field }) => <Field label={ar.clinicName} value={field.value ?? ''} onChangeText={field.onChange} error={errors.clinicName?.message} />} />
        <Controller control={control} name="email" render={({ field }) => <Field label={ar.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} error={errors.email?.message} />} />
        <Controller control={control} name="password" render={({ field }) => <Field label={ar.password} secureTextEntry autoComplete="new-password" value={field.value} onChangeText={field.onChange} error={errors.password?.message} />} />
        {errors.root?.message ? <AppText accessibilityRole="alert" color={colors.danger}>{errors.root.message}</AppText> : null}
        {notice ? <AppText accessibilityRole="alert" color={colors.successText}>{notice}</AppText> : null}
        <Button label="تجهيز الحساب" onPress={submit} loading={isSubmitting} />
        <View style={styles.inline}>
          <AppText variant="small" color={colors.muted}>{ar.hasAccount}</AppText>
          <Link href="/(auth)/login" style={styles.link}> {ar.login}</Link>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md }, card: { width: '100%', maxWidth: 520, gap: spacing.md }, inline: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center' }, link: { color: colors.green, minHeight: 44, paddingVertical: spacing.sm } });
