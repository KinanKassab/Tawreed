import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@tawreed/design-tokens';
import { Toast } from '@tawreed/ui';
import { Responsive, screenClass } from './responsive';
import { useToast } from '@/store/toast';

const HEADER_HEIGHT = 72;
const TOAST_HEIGHT = 36;
const TOAST_DURATION_MS = 3200;

function ToastEntry({ id, message, actionLabel, onAction, hide }: { id: number; message: string; actionLabel?: string; onAction?: () => void; hide: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => hide(id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [id, hide]);

  return <Toast message={message} actionLabel={actionLabel} onAction={onAction ? () => { onAction(); hide(id); } : undefined} />;
}

export function ToastHost() {
  const toasts = useToast((state) => state.toasts);
  const hide = useToast((state) => state.hide);
  const insets = useSafeAreaInsets();

  if (!toasts.length) return null;

  return (
    <Responsive>{(viewport) => {
      // Phones have free space in the middle of the header; wider screens keep their navigation there, so it sits just below.
      const phone = screenClass(viewport) === 'phone';
      const top = insets.top + (phone ? (HEADER_HEIGHT - TOAST_HEIGHT) / 2 : HEADER_HEIGHT + spacing.xs);
      return (
        <View pointerEvents="box-none" style={[styles.host, phone && styles.hostPhone, { top }]}>
          {toasts.map((toast) => <ToastEntry key={toast.id} id={toast.id} message={toast.message} actionLabel={toast.actionLabel} onAction={toast.onAction} hide={hide} />)}
        </View>
      );
    }}</Responsive>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center', zIndex: 30 },
  hostPhone: { left: 116, right: 60 },
});
