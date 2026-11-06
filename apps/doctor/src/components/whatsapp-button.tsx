import { Linking, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows, spacing } from '@tawreed/design-tokens';
import { Icon, MotionPressable } from '@tawreed/ui';
import { Responsive, screenClass } from './responsive';

// Digits only, international format without "+" (e.g. 9639XXXXXXXX), as wa.me expects.
const phoneDigits = (process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const chatUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent('مرحباً توريد، أحتاج مساعدة')}`;
const BOTTOM_NAV_HEIGHT = 82;
const SIZE = 56;

// Floating shortcut that opens a WhatsApp chat with Tawreed; wa.me hands off to the WhatsApp app on phones.
export function WhatsAppButton() {
  const insets = useSafeAreaInsets();
  if (phoneDigits.length < 8) return null;
  return <Responsive>{(viewport) => {
    const phone = screenClass(viewport) === 'phone';
    // On phones the button sits just above the bottom navigation bar.
    const bottom = phone ? BOTTOM_NAV_HEIGHT + Math.max(insets.bottom, spacing.xs) + spacing.sm : spacing.lg;
    return <MotionPressable
      accessibilityRole="link"
      accessibilityLabel="تواصل معنا عبر واتساب"
      onPress={() => { void Linking.openURL(chatUrl); }}
      style={[styles.button, { bottom, left: phone ? spacing.md : spacing.lg }]}
    >
      <Icon name="whatsapp" size={30} color="#FFFFFF" />
    </MotionPressable>;
  }}</Responsive>;
}

const styles = StyleSheet.create({
  // WhatsApp brand green, kept literal so the shortcut is instantly recognisable.
  button: { position: 'absolute', zIndex: 20, width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#25D366', ...shadows.soft, shadowOpacity: 0.18 },
});
