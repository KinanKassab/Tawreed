import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { createTawreedDataLayer, type TawreedDataLayer } from '@tawreed/data';
import { pageHydrated } from '@/hooks/use-hydration';
import { clientConfig } from '@/lib/runtime';

const DataContext = createContext<TawreedDataLayer | null>(null);
interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  authNotice: string | null;
  clearAuthNotice(): void;
  revalidateSession(): Promise<boolean>;
  signOut(): Promise<void>;
}
const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  authNotice: null,
  clearAuthNotice: () => undefined,
  revalidateSession: async () => false,
  signOut: async () => undefined,
});
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 86_400_000, retry: 1, networkMode: 'offlineFirst', refetchOnMount: 'always', refetchOnReconnect: 'always' }, mutations: { retry: 0, networkMode: 'online' } } });
const storedCache = createAsyncStoragePersister({ storage: AsyncStorage, key: 'tawreed-query-cache-v1' });
// Pre-rendered web pages show skeletons for query data. Restoring the stored cache before the page has hydrated would
// render cached data instead and break hydration (React #418) on every return visit. Queries stay paused while
// restoring, so the skeletons hold until then.
const persister: typeof storedCache = { ...storedCache, restoreClient: async () => { await pageHydrated; return storedCache.restoreClient(); } };

export function AppProviders({ children }: { children: ReactNode }) {
  const data = useMemo(() => clientConfig ? createTawreedDataLayer(clientConfig) : null, []);
  const [session, setSession] = useState<Session | null>(null);
  const previousUserId = useRef<string | null>(null);
  const suppressSignOutNotice = useRef(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(data));
  const clearPrivateQueries = useCallback(() => {
    queryClient.removeQueries({ predicate: (query) => ['orders', 'profile'].includes(String(query.queryKey[0])) });
  }, []);
  const revalidateSession = useCallback(async () => {
    if (!data) return false;
    try {
      const result = await data.auth.validateSession();
      if (result.invalidated) {
        clearPrivateQueries();
        setAuthNotice('انتهت الجلسة أو لم يعد الحساب متاحاً. سجّل الدخول من جديد للمتابعة.');
      }
      previousUserId.current = result.session?.user.id ?? null;
      setSession(result.session);
      return Boolean(result.session);
    } catch {
      // A temporary network failure must not sign the user out.
      return Boolean(previousUserId.current);
    }
  }, [clearPrivateQueries, data]);
  const signOut = useCallback(async () => {
    if (!data) return;
    suppressSignOutNotice.current = true;
    setAuthNotice(null);
    await data.auth.signOut();
    clearPrivateQueries();
    previousUserId.current = null;
    setSession(null);
  }, [clearPrivateQueries, data]);
  useEffect(() => {
    if (Platform.OS === 'web') {
      onlineManager.setEventListener((setOnline) => {
        const online = () => setOnline(true); const offline = () => setOnline(false);
        window.addEventListener('online', online); window.addEventListener('offline', offline);
        return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
      });
    } else onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))));
  }, []);
  useEffect(() => {
    if (!data) return;
    let mounted = true;
    data.auth.validateSession()
      .then(({ session: next, invalidated }) => {
        if (!mounted) return;
        if (invalidated) setAuthNotice('انتهت الجلسة أو لم يعد الحساب متاحاً. سجّل الدخول من جديد للمتابعة.');
        previousUserId.current = next?.user.id ?? null;
        setSession(next);
      })
      .catch(() => {
        // An unavailable backend must not crash the public/offline catalog shell.
        if (mounted) setSession(null);
      })
      .finally(() => { if (mounted) setLoading(false); });
    const { data: subscription } = data.client.auth.onAuthStateChange((event, next) => {
      const nextId = next?.user.id ?? null;
      if (previousUserId.current && nextId !== previousUserId.current) clearPrivateQueries();
      if (event === 'SIGNED_OUT' && previousUserId.current && !suppressSignOutNotice.current) {
        setAuthNotice('انتهت الجلسة أو لم يعد الحساب متاحاً. سجّل الدخول من جديد للمتابعة.');
      }
      if (event === 'SIGNED_IN') setAuthNotice(null);
      suppressSignOutNotice.current = false;
      previousUserId.current = nextId; setSession(next);
    });
    return () => { mounted = false; subscription.subscription.unsubscribe(); };
  }, [clearPrivateQueries, data]);
  useEffect(() => {
    if (!data) return;
    const validate = () => { void revalidateSession(); };
    const timer = setInterval(validate, 5 * 60_000);
    if (Platform.OS !== 'web') return () => clearInterval(timer);
    const visible = () => { if (document.visibilityState === 'visible') validate(); };
    window.addEventListener('online', validate);
    window.addEventListener('focus', validate);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', validate);
      window.removeEventListener('focus', validate);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [data, revalidateSession]);
  return <DataContext.Provider value={data}><SessionContext.Provider value={{ session, loading, authNotice, clearAuthNotice: () => setAuthNotice(null), revalidateSession, signOut }}><PersistQueryClientProvider client={queryClient} persistOptions={{ persister, buster: 'tawreed-motion-v4', dehydrateOptions: { shouldDehydrateQuery: (query) => query.state.status === 'success' && ['categories', 'products', 'product', 'orders', 'profile'].includes(String(query.queryKey[0])) } }}>{children}</PersistQueryClientProvider></SessionContext.Provider></DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
export const useSession = () => useContext(SessionContext);
