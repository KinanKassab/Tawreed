import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Surface } from '@tawreed/ui';
import { emailPasswordSchema } from '@tawreed/validation';
import { useData } from '@/providers/app-providers';

const EXPIRED_LINK_MESSAGE = 'انتهت صلاحية رابط الاستعادة أو تم استخدامه من قبل. اطلب رابطاً جديداً.';

export default function ResetPasswordScreen() {
  const data = useData();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkValid, setLinkValid] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!data) return;
      if (params.error) {
        if (active) { setLinkValid(false); setChecking(false); }
        return;
      }
      try {
        if (params.code) await data.auth.exchangeCodeForSession(params.code);
        const session = await data.auth.getSession();
        if (active) { setLinkValid(Boolean(session)); setChecking(false); }
      } catch {
        if (active) { setLinkValid(false); setChecking(false); }
      }
    })();
    return () => { active = false; };
  }, [data, params.code, params.error]);

  const submit = async () => {
    const parsed = emailPasswordSchema.shape.password.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'تحقق من كلمة المرور'); return; }
    setLoading(true);
    try {
      await data?.auth.updatePassword(password);
      router.replace('/(app)/(tabs)');
    } catch (caught) {
      setError(normalizeAppError(caught).messageAr);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <ScrollView contentContainerStyle={styles.page}><Surface style={styles.card}><AppText color={colors.textMuted}>نتحقق من رابط الاستعادة...</AppText></Surface></ScrollView>;
  }

  if (!linkValid) {
    return <ScrollView contentContainerStyle={styles.page}><Surface style={styles.card}>
      <AppText variant="h2">انتهت صلاحية الرابط</AppText>
      <AppText accessibilityRole="alert" color={colors.error}>{EXPIRED_LINK_MESSAGE}</AppText>
      <Button label="طلب رابط جديد" onPress={() => router.replace('/(auth)/forgot')} />
    </Surface></ScrollView>;
  }

  return <ScrollView contentContainerStyle={styles.page}><Surface style={styles.card}>
    <AppText variant="h2">كلمة مرور جديدة</AppText>
    <AppText color={colors.textMuted}>اختر كلمة مرور قوية لحسابك.</AppText>
    <Field label="كلمة المرور الجديدة" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} error={error ?? undefined} />
    <Button label="حفظ كلمة المرور" onPress={submit} loading={loading} />
  </Surface></ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  card: { width: '100%', maxWidth: 480, gap: spacing.md },
});
