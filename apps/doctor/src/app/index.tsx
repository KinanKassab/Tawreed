import { Redirect } from 'expo-router';
import { StateView } from '@tawreed/ui';
import { useData, useSession } from '@/providers/app-providers';
import { ar } from '@/locales/ar';
export default function Index() { const data = useData(); const { session, loading } = useSession(); if (!data) return <StateView title={ar.configurationTitle} message={ar.configurationMessage} />; if (loading) return <StateView loading title={ar.loading} message={ar.loadingMessage} />; return <Redirect href={session ? '/(app)/(tabs)' : '/(auth)/login'} />; }
