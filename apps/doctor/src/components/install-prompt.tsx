import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { AppText, Button, Icon } from '@tawreed/ui';
import { Responsive, screenClass } from './responsive';

const DISMISSED_KEY = 'tawreed-install-prompt-dismissed-at';
const DISMISS_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 4000;
const MOBILE_NAV_HEIGHT = 82;
const WHATSAPP_BUTTON_CLEARANCE = 56 + spacing.sm;

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

function isStandalone() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(display-mode: standalone)').matches || Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
}

export function InstallPrompt() {
  const insets = useSafeAreaInsets();
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || isStandalone()) return;
    let cancelled = false;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    AsyncStorage.getItem(DISMISSED_KEY).then((value) => {
      if (cancelled) return;
      const dismissedAt = value ? Number(value) : 0;
      if (Date.now() - dismissedAt < DISMISS_SNOOZE_MS) return;
      const timer = setTimeout(() => {
        if (cancelled) return;
        if (isIosSafari()) setShowIosInstructions(true);
        setVisible(true);
      }, SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    });

    return () => { cancelled = true; window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt); };
  }, []);

  const dismiss = () => {
    setVisible(false);
    void AsyncStorage.setItem(DISMISSED_KEY, String(Date.now()));
  };

  const install = async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    dismiss();
  };

  if (Platform.OS !== 'web' || !visible || (!deferredEvent && !showIosInstructions)) return null;

  return (
    <Responsive>{(viewport) => {
      const phone = screenClass(viewport) === 'phone';
      const bottom = (phone ? MOBILE_NAV_HEIGHT + Math.max(insets.bottom, spacing.xs) + spacing.sm : spacing.lg) + WHATSAPP_BUTTON_CLEARANCE;
      return (
        <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
          <View accessibilityRole="alert" style={styles.card}>
            <View style={styles.icon}><Icon name="home-outline" size={22} color={colors.primary} /></View>
            <View style={styles.copy}>
              <AppText variant="small" style={styles.title}>ثبّت تطبيق توريد على شاشتك الرئيسية</AppText>
              {showIosInstructions
                ? <AppText variant="caption" color={colors.textMuted}>افتح قائمة المشاركة ⬆ ثم اختر «إضافة إلى الشاشة الرئيسية».</AppText>
                : <AppText variant="caption" color={colors.textMuted}>وصول أسرع بدون فتح المتصفح كل مرة.</AppText>}
            </View>
            <View style={styles.actions}>
              {!showIosInstructions ? <Button label="تثبيت" onPress={install} style={styles.installButton} /> : null}
              <Button label="إغلاق" variant="text" onPress={dismiss} />
            </View>
          </View>
        </View>
      );
    }}</Responsive>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', insetInlineStart: spacing.sm, insetInlineEnd: spacing.sm, zIndex: 25 },
  card: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm, shadowColor: colors.text, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: '600' },
  actions: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs },
  installButton: { minWidth: 88 },
});
