import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import type { z } from 'zod';
import { colors, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AccountSkeleton, AppText, Button, ContentFade, Field, Icon, StateView, Surface } from '@tawreed/ui';
import { profileSchema } from '@tawreed/validation';
import { AppPage } from '@/components/app-page';
import { SwipeExclusion } from '@/components/swipe-tab-navigator';
import { useNetwork } from '@/hooks/use-network';
import { useData, useSession } from '@/providers/app-providers';
import { ar } from '@/locales/ar';

type ProfileInput = z.infer<typeof profileSchema>;

export default function AccountScreen() {
  const data = useData();
  const { session, signOut } = useSession();
  const { online } = useNetwork();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile', session?.user.id], queryFn: () => data!.profile.getMine(), enabled: Boolean(data && session) });
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', clinicName: null, defaultAddress: '' },
    values: profile.data ? { fullName: profile.data.fullName, clinicName: profile.data.clinicName, defaultAddress: profile.data.defaultAddress ?? '' } : undefined,
  });
  const update = useMutation({
    mutationFn: (input: ProfileInput) => {
      if (!online) throw { message: ar.offlineMutation };
      return data!.profile.updateMine(input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  if (profile.isLoading) return <AppPage><AccountSkeleton /></AppPage>;
  if (profile.isError) return <AppPage><StateView title="تعذر تحميل بيانات حسابك" message="لم نتمكن من جلب بياناتك لتعبية الحقول تلقائياً. تحقق من الاتصال وحاول مرة أخرى." actionLabel="إعادة المحاولة" onAction={() => profile.refetch()} /></AppPage>;

  return <AppPage><ContentFade style={styles.page}>
    <AppText variant="h1">حسابي</AppText>

    <SwipeExclusion><Surface style={styles.card}>
      <View style={styles.sectionTitle}><Icon name="map-marker-outline" size={22} color={colors.primary} /><AppText variant="h2">بيانات التوصيل</AppText></View>
      {profile.data?.email ? <AppText variant="small" color={colors.textMuted}>{profile.data.email}</AppText> : null}
      <Controller control={control} name="fullName" render={({ field }) => <Field label="الاسم الكامل" value={field.value} onChangeText={field.onChange} error={errors.fullName?.message} />} />
      <Controller control={control} name="clinicName" render={({ field }) => <Field label="اسم العيادة أو الجهة" value={field.value ?? ''} onChangeText={field.onChange} error={errors.clinicName?.message} />} />
      <Controller control={control} name="defaultAddress" render={({ field }) => <Field label="عنوان التوصيل الافتراضي" multiline value={field.value} onChangeText={field.onChange} error={errors.defaultAddress?.message} />} />
      {update.error ? <AppText accessibilityRole="alert" color={colors.error}>{normalizeAppError(update.error).messageAr}</AppText> : null}
      {update.isSuccess ? <AppText accessibilityRole="alert" color={colors.successText}>تم حفظ البيانات.</AppText> : null}
      <Button label="حفظ البيانات" onPress={handleSubmit((input) => update.mutate(input))} loading={update.isPending} />
    </Surface></SwipeExclusion>

    <Surface style={styles.card}>
      <View style={styles.sectionTitle}><Icon name="clipboard-text-outline" size={22} color={colors.primary} /><AppText variant="h2">طلباتي</AppText></View>
      <AppText color={colors.textMuted}>راجع حالة طلباتك الحالية والسابقة.</AppText>
      <Button label="عرض طلباتي" variant="outline" onPress={() => router.push('/(app)/(tabs)/orders')} />
    </Surface>

    <Surface style={styles.card}>
      <View style={styles.sectionTitle}><Icon name="shield-check-outline" size={22} color={colors.primary} /><AppText variant="h2">الدعم</AppText></View>
      <AppText color={colors.textMuted}>يمكنك الإبلاغ عن مشكلة، وستظهر قنوات التواصل الرسمية عند اعتمادها.</AppText>
      <Button label="الإبلاغ عن مشكلة" variant="outline" onPress={() => router.push('/support')} />
      <Button label="تسجيل الخروج" variant="text" onPress={async () => { await signOut(); reset(); router.replace('/(auth)/login'); }} />
    </Surface>
  </ContentFade></AppPage>;
}

const styles = StyleSheet.create({
  page: { gap: spacing.xl },
  card: { gap: spacing.md },
  sectionTitle: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
});
