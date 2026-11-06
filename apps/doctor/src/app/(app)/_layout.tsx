import { Redirect, Stack, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { StateView } from '@tawreed/ui';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { SwipeTabNavigator } from '@/components/swipe-tab-navigator';
import { WhatsAppButton } from '@/components/whatsapp-button';
import { useData, useSession } from '@/providers/app-providers';
import { ar } from '@/locales/ar';
import { swipeTransition } from '@/lib/main-navigation';

export default function AppLayout() {
  const data = useData();
  const { session, loading } = useSession();
  const pathname = usePathname();
  const publicPage = pathname === '/' || pathname === '/catalog' || pathname === '/cart' || pathname.startsWith('/product/');
  if (!data) return <StateView title={ar.configurationTitle} message={ar.configurationMessage} />;
  // Public pages render straight away (and at static build time) instead of waiting for the stored session.
  if (loading && !publicPage) return <StateView loading title={ar.loading} message={ar.loadingMessage} />;
  if (!session && !publicPage) return <Redirect href={{ pathname: '/(auth)/login', params: { returnTo: pathname } }} />;
  return <View style={styles.shell}><View style={styles.content}><SwipeTabNavigator><Stack screenOptions={() => ({ headerShown: false, animation: swipeTransition.active ? 'none' : 'slide_from_left' })} /></SwipeTabNavigator></View><MobileBottomNav /><WhatsAppButton /></View>;
}

const styles = StyleSheet.create({ shell: { flex: 1 }, content: { flex: 1 } });
