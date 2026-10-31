import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing, typography } from '@tawreed/design-tokens';
import { formatNumber, normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Surface } from '@tawreed/ui';
import { registerSchema, type RegisterInput } from '@tawreed/validation';
import { DeliveryLocationPicker } from '@/components/delivery-location-picker';
import { useData } from '@/providers/app-providers';

const steps = ['الاسم', 'التواصل', 'التوصيل'] as const;
const contactOptions = [
  { value: 'phone', label: 'اتصال هاتفي', icon: 'phone-outline' },
  { value: 'whatsapp', label: 'واتساب', icon: 'whatsapp' },
  { value: 'email', label: 'بريد إلكتروني', icon: 'email-outline' },
] as const;

function safeReturnTo(value: string | string[] | undefined): '/(app)/(tabs)' | '/checkout' {
  return value === '/checkout' ? '/checkout' : '/(app)/(tabs)';
}

export default function RegisterScreen() {
  const data = useData();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(params.returnTo);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [activationEmail, setActivationEmail] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting }, setError, trigger } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '', lastName: '', email: '', phone: '+963', password: '', preferredContact: 'whatsapp',
      deliveryAddress: '', latitude: null, longitude: null, googlePlaceId: null,
    },
  });

  const next = async () => {
    const fields: (keyof RegisterInput)[][] = [
      ['firstName', 'lastName'],
      ['email', 'phone', 'password', 'preferredContact'],
    ];
    if (await trigger(fields[step] ?? [])) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submit = handleSubmit(async (values) => {
    if (!data) return;
    setNotice(null);
    try {
      const signedIn = await data.auth.signUpWithPassword(values);
      if (signedIn) {
        router.replace(returnTo);
        return;
      }
      setActivationEmail(values.email.trim().toLowerCase());
      setNotice('أرسلنا رمز تفعيل من 6 أرقام إلى بريدك الإلكتروني.');
    } catch (error) {
      setError('root', { message: normalizeAppError(error).messageAr });
    }
  });

  const verifyCode = async () => {
    if (!data || !activationEmail || !/^\d{6}$/.test(activationCode)) return;
    setActivationLoading(true); setNotice(null);
    try { await data.auth.verifySignupCode(activationEmail, activationCode); router.replace(returnTo); }
    catch (error) { setNotice(normalizeAppError(error).messageAr); }
    finally { setActivationLoading(false); }
  };

  if (activationEmail && data) return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><Surface style={styles.card}><AppText variant="h2">تفعيل البريد الإلكتروني</AppText><AppText color={colors.textMuted}>أدخل الرمز المرسل إلى {activationEmail}. تنتهي صلاحيته خلال ساعة.</AppText><Field label="رمز التفعيل" autoComplete="one-time-code" keyboardType="number-pad" maxLength={6} value={activationCode} onChangeText={(value) => setActivationCode(value.replace(/\D/g, ''))} /><AppText accessibilityRole="alert" color={notice?.startsWith('أرسلنا') ? colors.successText : colors.error}>{notice}</AppText><Button label="تفعيل الحساب" loading={activationLoading} disabled={!/^\d{6}$/.test(activationCode)} onPress={verifyCode} /><Button label="إعادة إرسال الرمز" variant="outline" onPress={async () => { try { await data.auth.resendSignupCode(activationEmail); setNotice('أرسلنا رمز تفعيل جديداً.'); } catch (error) { setNotice(normalizeAppError(error).messageAr); } }} /></Surface></ScrollView></KeyboardAvoidingView>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Surface style={styles.card}>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => step ? setStep(step - 1) : router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-right" size={24} color={colors.text} /></Pressable>
            <View style={styles.heading}><AppText variant="h2">تجهيز حسابك</AppText><AppText color={colors.textMuted}>الخطوة {formatNumber(step + 1)} من {formatNumber(steps.length)}</AppText></View>
          </View>
          <View accessibilityLabel={`الخطوة ${step + 1} من ${steps.length}`} style={styles.progress}>
            {steps.map((label, index) => <View key={label} style={styles.progressItem}><View style={[styles.progressDot, index <= step && styles.progressDotActive]} /><AppText variant="caption" color={index <= step ? colors.text : colors.textMuted}>{label}</AppText></View>)}
          </View>

          {step === 0 ? <View style={styles.step}>
            <View><AppText variant="h3">ما اسمك؟</AppText><AppText color={colors.textMuted}>سنستخدمه باسم المستلم في طلباتك.</AppText></View>
            <Controller control={control} name="firstName" render={({ field }) => <Field label="الاسم الأول" autoComplete="given-name" value={field.value} onChangeText={field.onChange} error={errors.firstName?.message} />} />
            <Controller control={control} name="lastName" render={({ field }) => <Field label="الاسم الثاني" autoComplete="family-name" value={field.value} onChangeText={field.onChange} error={errors.lastName?.message} />} />
            <Button label="التالي" onPress={next} />
          </View> : null}

          {step === 1 ? <View style={styles.step}>
            <View><AppText variant="h3">بيانات الدخول والتواصل</AppText><AppText color={colors.textMuted}>البريد للدخول إلى الحساب، والرقم للتواصل معك حول الطلب والتوصيل.</AppText></View>
            <Controller control={control} name="email" render={({ field }) => <Field label="البريد الإلكتروني" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} error={errors.email?.message} />} />
            <Controller control={control} name="phone" render={({ field }) => <Field label="رقم الهاتف" autoComplete="tel" keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} error={errors.phone?.message} />} />
            <Controller control={control} name="password" render={({ field }) => <Field label="كلمة المرور" secureTextEntry autoComplete="new-password" value={field.value} onChangeText={field.onChange} error={errors.password?.message} />} />
            <View style={styles.contactGroup}><AppText variant="small">كيف تفضّل أن نتابع معك؟</AppText><Controller control={control} name="preferredContact" render={({ field }) => <View style={styles.contactOptions}>{contactOptions.map((option) => { const selected = field.value === option.value; return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => field.onChange(option.value)} style={[styles.contactOption, selected && styles.contactOptionSelected]}><MaterialCommunityIcons name={option.icon} size={21} color={selected ? colors.onPrimary : colors.textMuted} /><AppText variant="small" color={selected ? colors.onPrimary : colors.text}>{option.label}</AppText></Pressable>; })}</View>} /></View>
            <Button label="التالي" onPress={next} />
          </View> : null}

          {step === 2 ? <View style={styles.step}>
            <View><AppText variant="h3">أين نوصّل طلباتك؟</AppText><AppText color={colors.textMuted}>استخدم موقعك الحالي أو حدّد النقطة الصحيحة على الخريطة، ثم راجع العنوان.</AppText></View>
            <Controller control={control} name="deliveryAddress" render={({ field }) => <Controller control={control} name="latitude" render={({ field: latitudeField }) => <Controller control={control} name="longitude" render={({ field: longitudeField }) => <Controller control={control} name="googlePlaceId" render={({ field: placeField }) => <DeliveryLocationPicker value={{ address: field.value, latitude: latitudeField.value, longitude: longitudeField.value, googlePlaceId: placeField.value }} error={errors.deliveryAddress?.message} onChange={(location) => { field.onChange(location.address); latitudeField.onChange(location.latitude); longitudeField.onChange(location.longitude); placeField.onChange(location.googlePlaceId); }} />} />} />} />} />
            {errors.root?.message ? <AppText accessibilityRole="alert" color={colors.error}>{errors.root.message}</AppText> : null}
            {notice ? <AppText accessibilityRole="alert" color={colors.successText}>{notice}</AppText> : null}
            <Button label="تجهيز الحساب والمتابعة" onPress={submit} loading={isSubmitting} />
          </View> : null}

          <View style={styles.inline}><AppText variant="small" color={colors.textMuted}>لديك حساب؟</AppText><Link href={{ pathname: '/(auth)/login', params: { returnTo } }} style={styles.link}> تسجيل الدخول</Link></View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.backgroundSubtle },
  card: { width: '100%', maxWidth: 580, gap: spacing.xl },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md },
  heading: { flex: 1, gap: spacing.xs },
  back: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  progress: { flexDirection: 'row-reverse', gap: spacing.sm },
  progressItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  progressDot: { width: '100%', height: 5, borderRadius: 4, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.accent },
  step: { gap: spacing.md },
  contactGroup: { gap: spacing.sm },
  contactOptions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  contactOption: { minHeight: 48, flexGrow: 1, flexBasis: 145, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  contactOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  inline: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center' },
  link: { color: colors.primary, minHeight: 44, paddingVertical: spacing.sm, fontFamily: typography.family.semibold },
});
