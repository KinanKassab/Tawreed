import { router } from 'expo-router';
import { StateView } from '@tawreed/ui';
import { AppPage } from '@/components/app-page';

export default function NotFoundScreen() {
  return <AppPage><StateView title="الصفحة غير موجودة" message="الرابط غير صحيح أو أن الصفحة لم تعد متاحة." actionLabel="العودة إلى الرئيسية" onAction={() => router.replace('/(app)/(tabs)')} /></AppPage>;
}
