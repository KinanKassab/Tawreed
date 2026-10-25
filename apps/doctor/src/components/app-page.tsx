import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { OfflineBanner } from '@tawreed/ui';
import { AppHeader } from './app-header';
import { useNetwork } from '@/hooks/use-network';

export function AppPage({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { online } = useNetwork();
  const body = <View style={styles.content}>{children}</View>;
  return <View style={styles.page}><AppHeader />{!online ? <OfflineBanner /> : null}{scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}</View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.soft }, scroll: { flexGrow: 1, paddingBottom: 96 }, content: { width: '100%', maxWidth: 1200, alignSelf: 'center', padding: spacing.md, gap: spacing.xl } });
