import { Redirect } from 'expo-router';
import { StateView } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { ar } from '@/locales/ar';
export default function Index() { const data = useData(); if (!data) return <StateView title={ar.configurationTitle} message={ar.configurationMessage} />; return <Redirect href="/(app)/(tabs)" />; }
