import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { breakpoints, colors, radius, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Icon, Surface } from '@tawreed/ui';
import { emailPasswordSchema, type EmailPasswordInput } from '@tawreed/validation';
import { useData } from '@/providers/app-providers';

export default function LoginScreen() {
  const data = useData();
  const { width } = useWindowDimensions();
  const compact = width < breakpoints.tablet;
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

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={[styles.page, compact ? styles.pageCompact : undefined]} keyboardShouldPersistTaps="handled"><View style={[styles.brandPanel, compact ? styles.brandPanelCompact : undefined]}><View style={styles.brand}><View style={styles.brandIcon}><Icon name="truck-delivery-outline" size={32} color={colors.deep} /></View><View><AppText variant="h1" color={colors.white}>توريد</AppText><AppText color={colors.mint}>لوحة العمليات والإدارة</AppText></View></View><View style={styles.brandCopy}><AppText variant={compact ? 'h3' : 'h2'} color={colors.white}>إدارة واضحة ليوم عمل أسرع</AppText>{!compact ? <AppText color={colors.mint}>الطلبات والكتالوج والمخزون وسعر الصرف في مساحة عمل عربية واحدة.</AppText> : null}</View></View><View style={styles.formPane}><Surface style={compact ? [styles.card, styles.cardCompact] : styles.card}><View style={styles.lockIcon}><Icon name="shield-lock-outline" size={24} color={colors.deep} /></View><View style={styles.heading}><AppText variant="h2">دخول الفريق</AppText><AppText color={colors.muted}>استخدم الحساب الذي جهّزه مدير النظام لك.</AppText></View><Controller control={control} name="email" render={({ field }) => <Field label="البريد الإلكتروني" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message} />} /><Controller control={control} name="password" render={({ field }) => <Field label="كلمة المرور" secureTextEntry autoComplete="current-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message} />} />{errors.root?.message ? <AppText accessibilityRole="alert" color={colors.danger}>{errors.root.message}</AppText> : null}{accessError ? <AppText accessibilityRole="alert" color={colors.danger}>{accessError}</AppText> : null}<Button label="دخول آمن" onPress={submit} loading={isSubmitting} /></Surface></View></ScrollView></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, minHeight: '100%', flexDirection: 'row-reverse', backgroundColor: colors.soft }, pageCompact: { flexDirection: 'column' },
  brandPanel: { flex: 1, minHeight: 640, justifyContent: 'space-between', padding: spacing.xxxl, backgroundColor: colors.deep }, brandPanelCompact: { flex: 0, minHeight: 220, padding: spacing.xl },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md }, brandIcon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }, brandCopy: { maxWidth: 520, gap: spacing.sm },
  formPane: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 480, gap: spacing.md, padding: spacing.xxl }, cardCompact: { padding: spacing.lg, marginTop: -spacing.xxxl }, lockIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  heading: { gap: spacing.xs, marginBottom: spacing.xs },
});
