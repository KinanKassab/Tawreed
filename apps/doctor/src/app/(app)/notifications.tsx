import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View } from 'react-native';
import { colors } from '@tawreed/design-tokens';
import { AppText, StateView } from '@tawreed/ui';
import { AppPage } from '@/components/app-page';

export default function NotificationsScreen() {
  return <AppPage><View style={{ alignItems: 'flex-end' }}><AppText variant="h1">الإشعارات</AppText></View><View style={{ alignItems: 'center' }}><MaterialCommunityIcons name="bell-check-outline" size={52} color={colors.primary} /></View><StateView title="ستتفعل قريباً" message="نعمل على تجهيز إشعارات الطلبات والتحديثات المهمة لك." /></AppPage>;
}
