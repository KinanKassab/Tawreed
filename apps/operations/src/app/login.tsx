import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Surface } from '@tawreed/ui';
import { emailPasswordSchema, type EmailPasswordInput } from '@tawreed/validation';
import { useData } from '@/providers/app-providers';

export default function LoginScreen() {
  const data = useData();
  const [accessError, setAccessError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<EmailPasswordInput>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    if (!data) return;
    setAccessError(null);
    try {
      await data.auth.signInWithPassword(values.email, values.password);
      const context = await data.operations.getMyContext();
      if (!context) {
        await data.auth.signOut();
        setAccessError('هذا الحساب غير مخوّل للدخول إلى لوحة توريد الداخلية.');
        return;
      }
      router.replace('/dashboard');
    } catch (error) {
      setError('root', { message: normalizeAppError(error).messageAr });
    }
  });

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.brand}><AppText variant="h1">توريد</AppText><AppText color={colors.green}>لوحة العمليات والإدارة</AppText></View><Surface style={styles.card}><View style={styles.heading}><AppText variant="h2">دخول الفريق</AppText><AppText color={colors.muted}>استخدم الحساب الذي جهّزه مدير النظام لك.</AppText></View><Controller control={control} name="email" render={({ field }) => <Field label="البريد الإلكتروني" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />} /><Controller control={control} name="password" render={({ field }) => <Field label="كلمة المرور" secureTextEntry autoComplete="current-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />} />{errors.root?.message ? <AppText accessibilityRole="alert" color={colors.danger}>{errors.root.message}</AppText> : null}{accessError ? <AppText accessibilityRole="alert" color={colors.danger}>{accessError}</AppText> : null}<Button label="دخول آمن" onPress={submit} loading={isSubmitting} /></Surface></ScrollView></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.soft },
  brand: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.xs },
  card: { width: '100%', maxWidth: 480, gap: spacing.md },
  heading: { gap: spacing.xs, marginBottom: spacing.xs },
});
