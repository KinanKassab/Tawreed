import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '@tawreed/design-tokens';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
    <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-outline" color={String(color ?? colors.muted)} size={size} /> }} />
    <Tabs.Screen name="catalog" options={{ title: 'المنتجات', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-grid-outline" color={String(color ?? colors.muted)} size={size} /> }} />
    <Tabs.Screen name="orders" options={{ title: 'طلباتي', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-text-outline" color={String(color ?? colors.muted)} size={size} /> }} />
    <Tabs.Screen name="account" options={{ title: 'الحساب', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={String(color ?? colors.muted)} size={size} /> }} />
  </Tabs>;
}
