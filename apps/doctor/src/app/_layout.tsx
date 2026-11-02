import 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { I18nManager, Platform, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '@tawreed/design-tokens';
import { markPageHydrated, pageHydrated } from '@/hooks/use-hydration';
import { AppProviders } from '@/providers/app-providers';
import { useCart } from '@/store/cart';

I18nManager.allowRTL(true); I18nManager.forceRTL(true);
void SplashScreen.preventAutoHideAsync();
// Web gets subset WOFF2 files via @font-face in index.html (font-display: swap), so rendering never waits on fonts there.
const nativeFonts: Parameters<typeof useFonts>[0] = Platform.OS === 'web' ? {} : {
  NotoKufiArabic: require('../../assets/fonts/kufi.ttf'),
  Manrope: require('../../assets/fonts/manrope.ttf'),
};
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(nativeFonts);
  // The web cart is pre-rendered empty; restore it once the page has hydrated so the badge cannot break hydration.
  useEffect(() => { if (Platform.OS === 'web') void pageHydrated.then(() => useCart.persist.rehydrate()); }, []);
  // Pages without AppPage (sign-in) never signal hydration; any navigation away from the first URL means it is done.
  const pathname = usePathname();
  const firstPathname = useRef(pathname);
  useEffect(() => { if (pathname !== firstPathname.current) markPageHydrated(); }, [pathname]);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
      document.title = 'توريد | مستلزماتك الطبية';
      const ensureMeta = (name: string, content: string) => {
        let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
        if (!element) { element = document.createElement('meta'); element.name = name; document.head.appendChild(element); }
        element.content = content;
      };
      const ensureLink = (rel: string, href: string, type?: string) => {
        let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][href="${href}"]`);
        if (!element) { element = document.createElement('link'); element.rel = rel; element.href = href; document.head.appendChild(element); }
        if (type) element.type = type;
      };
      ensureMeta('theme-color', colors.surface);
      ensureMeta('application-name', 'توريد');
      ensureMeta('apple-mobile-web-app-title', 'توريد');
      ensureLink('manifest', '/manifest.webmanifest');
      ensureLink('icon', '/favicon.ico');
      ensureLink('icon', '/favicon.svg', 'image/svg+xml');
      ensureLink('apple-touch-icon', '/apple-touch-icon.png');
      if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
    }
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);
  if (!fontsLoaded && !fontError) return null;
  return <GestureHandlerRootView style={styles.root}><SafeAreaProvider><AppProviders><StatusBar style="dark" /><SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.backgroundSubtle }, animation: 'fade' }} /></SafeAreaView></AppProviders></SafeAreaProvider></GestureHandlerRootView>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.surface } });
