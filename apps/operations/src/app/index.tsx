import { Redirect } from 'expo-router';
import { StateView } from '@tawreed/ui';
import { useData, useSession } from '@/providers/app-providers';

export default function Index() {
  const data = useData();
  const { session, loading } = useSession();
  if (!data) return <StateView title="إعداد الاتصال غير مكتمل" message="أضف إعدادات Supabase الخاصة بلوحة العمليات." />;
  if (loading) return <StateView loading title="جاري التحميل" message="نتحقق من جلسة العمل الآمنة." />;
  return <Redirect href={session ? '/dashboard' : '/login'} />;
}
