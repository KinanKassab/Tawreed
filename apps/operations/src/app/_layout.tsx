import { useEffect } from 'react';
import { I18nManager, Platform, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@tawreed/design-tokens';
import { AppProviders } from '@/providers/app-providers';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    }
  }, []);
  return <SafeAreaProvider><AppProviders><StatusBar style="dark" /><SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.soft } }} /></SafeAreaView></AppProviders></SafeAreaProvider>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.soft } });
