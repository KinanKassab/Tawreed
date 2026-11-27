import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch, View, StyleSheet } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { normalizeAppError } from '@tawreed/domain';
import { AppText, Button, Field, Surface } from '@tawreed/ui';
import { operationsTheme } from '@/lib/operations-theme';
import { useData } from '@/providers/app-providers';

type Settings = {
  enabled: boolean; chatId: string; tokenConfigured: boolean; tokenHint: string;
  notifyNewOrders: boolean; notifyOrderStatus: boolean; notifyCatalogRequests: boolean; notifySupportRequests: boolean;
};

const alerts: { key: keyof Settings; title: string; description: string }[] = [
  { key: 'notifyNewOrders', title: 'طلب جديد', description: 'رقم الطلب والاسم والهاتف والعنوان والإجمالي.' },
  { key: 'notifyOrderStatus', title: 'تغيير حالة الطلب', description: 'عند تحديث حالة أي طلب من اللوحة.' },
  { key: 'notifyCatalogRequests', title: 'طلب إضافة منتج', description: 'اسم المنتج وكلمات البحث التي أرسلها الطبيب.' },
  { key: 'notifySupportRequests', title: 'رسالة دعم جديدة', description: 'الموضوع ونص رسالة الدعم.' },
];

export function TelegramSettings({ onFeedback }: { onFeedback: (message: string, error?: boolean) => void }) {
  const data = useData();
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState('');
  const [draft, setDraft] = useState<Settings | null>(null);
  const query = useQuery({
    queryKey: ['operations-telegram-settings'],
    queryFn: async () => {
      const { data: result, error } = await data!.client.rpc('operations_get_telegram_settings');
      if (error) throw error;
      return result as unknown as Settings;
    },
    enabled: Boolean(data),
  });
  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);

  const save = useMutation({
    mutationFn: async (settings: Settings) => {
      const { error } = await data!.client.rpc('operations_save_telegram_settings', {
        p_bot_token: botToken.trim() || null,
        p_chat_id: settings.chatId,
        p_enabled: settings.enabled,
        p_notify_new_orders: settings.notifyNewOrders,
        p_notify_order_status: settings.notifyOrderStatus,
        p_notify_catalog_requests: settings.notifyCatalogRequests,
        p_notify_support_requests: settings.notifySupportRequests,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setBotToken('');
      await queryClient.invalidateQueries({ queryKey: ['operations-telegram-settings'] });
      onFeedback('تم حفظ إعدادات تيليغرام.');
    },
    onError: (error) => onFeedback(normalizeAppError(error).messageAr, true),
  });

  if (!draft) return <Surface style={styles.panel}><AppText>{query.isError ? 'تعذر تحميل إعدادات تيليغرام.' : 'جاري تحميل الإعدادات...'}</AppText>{query.isError ? <Button label="إعادة المحاولة" variant="outline" onPress={() => query.refetch()} /> : null}</Surface>;

  const toggle = (key: keyof Settings, value: boolean) => setDraft((current) => current ? { ...current, [key]: value } : current);
  return <View style={styles.page}>
    <Surface style={styles.panel}>
      <AppText variant="h3">ربط بوت تيليغرام</AppText>
      <AppText color={colors.muted}>أنشئ بوتًا عبر BotFather، ثم الصق رمز البوت وحدد رقم المحادثة التي تريد استقبال التنبيهات فيها. أرسل للبوت رسالة /start أولًا حتى يسمح تيليغرام بالرسائل.</AppText>
      <Field label={draft.tokenConfigured ? `رمز البوت (محفوظ ${draft.tokenHint})` : 'رمز البوت'} value={botToken} onChangeText={setBotToken} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder={draft.tokenConfigured ? 'اتركه فارغًا للإبقاء على الرمز الحالي' : '123456789:AA...'} />
      <Field label="رقم المحادثة (Chat ID)" value={draft.chatId} onChangeText={(chatId) => setDraft((current) => current ? { ...current, chatId } : current)} autoCapitalize="none" autoCorrect={false} placeholder="مثال: 123456789 أو -100..." />
      <AppText variant="caption" color={colors.muted}>للعثور على الرقم: أرسل /start للبوت، ثم افتح getUpdates باستخدام رمز البوت وخذ القيمة من message.chat.id. للمجموعات أضف البوت إليها، وأرسل رسالة، ثم استخدم رقم المجموعة الذي يبدأ عادةً بـ -100.</AppText>
      <View style={styles.switchRow}><View style={styles.switchCopy}><AppText variant="small">تفعيل إشعارات تيليغرام</AppText><AppText variant="caption" color={colors.muted}>تُرسل الإشعارات تلقائيًا عند وقوع الأحداث المحددة أدناه.</AppText></View><Switch value={draft.enabled} onValueChange={(value) => toggle('enabled', value)} trackColor={{ false: colors.border, true: colors.primary }} /></View>
    </Surface>
    <Surface style={styles.panel}>
      <AppText variant="h3">متى تصلك رسالة؟</AppText>
      {alerts.map((alert) => <View key={alert.key} style={styles.alertRow}><View style={styles.alertCopy}><AppText variant="small">{alert.title}</AppText><AppText variant="caption" color={colors.muted}>{alert.description}</AppText></View><Switch value={Boolean(draft[alert.key])} onValueChange={(value) => toggle(alert.key, value)} trackColor={{ false: colors.border, true: colors.primary }} /></View>)}
      <Button label={save.isPending ? 'جاري الحفظ...' : 'حفظ إعدادات تيليغرام'} onPress={() => save.mutate(draft)} disabled={save.isPending || (!draft.tokenConfigured && !botToken.trim()) || !draft.chatId.trim()} loading={save.isPending} />
      <AppText variant="caption" color={colors.muted}>رمز البوت محفوظ في مخطط قاعدة بيانات خاص ولا يُعاد إظهاره في اللوحة. اترك حقل الرمز فارغًا للإبقاء على الرمز المحفوظ.</AppText>
    </Surface>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: spacing.md }, panel: { gap: spacing.md, borderColor: operationsTheme.line },
  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  switchCopy: { flex: 1, gap: 3, alignItems: 'flex-end' },
  alertRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: operationsTheme.line },
  alertCopy: { flex: 1, gap: 3, alignItems: 'flex-end' },
});
