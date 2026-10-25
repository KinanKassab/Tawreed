import { AppText, StateView } from '@tawreed/ui'; import { AppPage } from '@/components/app-page';
export default function NotificationsScreen() { return <AppPage><AppText variant="h1">الإشعارات</AppText><StateView title="لا توجد إشعارات جديدة" message="ستظهر هنا تحديثات طلباتك فور توفرها." /></AppPage>; }
