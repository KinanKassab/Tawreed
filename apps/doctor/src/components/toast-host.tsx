import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@tawreed/design-tokens';
import { Toast } from '@tawreed/ui';
import { Responsive, screenClass } from './responsive';
import { useToast } from '@/store/toast';

const MOBILE_NAV_HEIGHT = 82;
const TOAST_DURATION_MS = 3200;

export function ToastHost() {
  const { message, actionLabel, onAction, hide } = useToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, hide]);

  if (!message) return null;

  return (
    <Responsive>{(viewport) => {
      const phone = screenClass(viewport) === 'phone';
      const bottom = phone ? MOBILE_NAV_HEIGHT + Math.max(insets.bottom, spacing.xs) + spacing.sm : spacing.xl;
      return (
        <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
          <Toast message={message} actionLabel={actionLabel} onAction={onAction ? () => { onAction(); hide(); } : undefined} />
        </View>
      );
    }}</Responsive>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', insetInlineStart: spacing.md, insetInlineEnd: spacing.md, zIndex: 30 },
});
