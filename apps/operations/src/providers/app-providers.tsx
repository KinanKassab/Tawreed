import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createTawreedDataLayer, type TawreedDataLayer } from '@tawreed/data';
import { clientConfig } from '@/lib/runtime';

const DataContext = createContext<TawreedDataLayer | null>(null);
const SessionContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 }, mutations: { retry: 0 } } });

export function AppProviders({ children }: { children: ReactNode }) {
  const data = useMemo(() => clientConfig ? createTawreedDataLayer(clientConfig) : null, []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(data));

  useEffect(() => {
    if (!data) return;
    data.auth.getSession().then(setSession).finally(() => setLoading(false));
    const { data: subscription } = data.client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) queryClient.clear();
    });
    return () => subscription.subscription.unsubscribe();
  }, [data]);

  return (
    <DataContext.Provider value={data}>
      <SessionContext.Provider value={{ session, loading }}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SessionContext.Provider>
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
export const useSession = () => useContext(SessionContext);
