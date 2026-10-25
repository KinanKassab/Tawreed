import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { StateView } from '@tawreed/ui';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { useSession } from '@/providers/app-providers';
import { ar } from '@/locales/ar';

export default function ProtectedLayout() {
  const { session, loading } = useSession();
  if (loading) return <StateView loading title={ar.loading} message={ar.loadingMessage} />;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <View style={styles.shell}><View style={styles.content}><Stack screenOptions={{ headerShown: false }} /></View><MobileBottomNav /></View>;
}

const styles = StyleSheet.create({ shell: { flex: 1 }, content: { flex: 1 } });
