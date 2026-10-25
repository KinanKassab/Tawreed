import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { createTawreedDataLayer, type TawreedDataLayer } from '@tawreed/data';
import { clientConfig } from '@/lib/runtime';

const DataContext = createContext<TawreedDataLayer | null>(null);
const SessionContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 86_400_000, retry: 1, networkMode: 'offlineFirst' }, mutations: { retry: 0, networkMode: 'online' } } });
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'tawreed-query-cache-v1' });

export function AppProviders({ children }: { children: ReactNode }) {
  const data = useMemo(() => clientConfig ? createTawreedDataLayer(clientConfig) : null, []);
  const [session, setSession] = useState<Session | null>(null);
  const previousUserId = useRef<string | null>(null);
  const [loading, setLoading] = useState(Boolean(data));
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
    data.auth.getSession().then((next) => { previousUserId.current = next?.user.id ?? null; setSession(next); }).finally(() => setLoading(false));
    const { data: subscription } = data.client.auth.onAuthStateChange((_event, next) => {
      const nextId = next?.user.id ?? null;
      if (previousUserId.current && nextId !== previousUserId.current) queryClient.removeQueries({ predicate: (query) => ['orders', 'profile'].includes(String(query.queryKey[0])) });
      previousUserId.current = nextId; setSession(next);
    });
    return () => subscription.subscription.unsubscribe();
  }, [data]);
  return <DataContext.Provider value={data}><SessionContext.Provider value={{ session, loading }}><PersistQueryClientProvider client={queryClient} persistOptions={{ persister, buster: 'tawreed-v1', dehydrateOptions: { shouldDehydrateQuery: (query) => ['categories', 'products', 'product', 'orders'].includes(String(query.queryKey[0])) } }}>{children}</PersistQueryClientProvider></SessionContext.Provider></DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
export const useSession = () => useContext(SessionContext);
