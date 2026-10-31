import { Redirect, Stack, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { StateView } from '@tawreed/ui';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { SwipeTabNavigator } from '@/components/swipe-tab-navigator';
import { useSession } from '@/providers/app-providers';
import { ar } from '@/locales/ar';

export default function AppLayout() {
  const { session, loading } = useSession();
  const pathname = usePathname();
  const publicPage = pathname === '/' || pathname === '/catalog' || pathname === '/cart' || pathname.startsWith('/product/');
  if (loading) return <StateView loading title={ar.loading} message={ar.loadingMessage} />;
  if (!session && !publicPage) return <Redirect href={{ pathname: '/(auth)/login', params: { returnTo: pathname } }} />;
  return <View style={styles.shell}><View style={styles.content}><SwipeTabNavigator><Stack screenOptions={{ headerShown: false, animation: 'slide_from_left' }} /></SwipeTabNavigator></View><MobileBottomNav /></View>;
}

const styles = StyleSheet.create({ shell: { flex: 1 }, content: { flex: 1 } });
