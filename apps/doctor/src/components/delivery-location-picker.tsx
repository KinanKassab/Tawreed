import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { AppText, Button, Field, Icon } from '@tawreed/ui';
import { MapSelector, reverseGeocodePoint, type MapPoint } from './map-selector';

export interface DeliveryLocationValue {
  address: string;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
}

export function DeliveryLocationPicker({ value, error, onChange }: { value: DeliveryLocationValue; error?: string; onChange: (value: DeliveryLocationValue) => void }) {
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const point = value.latitude !== null && value.longitude !== null ? { latitude: value.latitude, longitude: value.longitude } : null;
  const mapPoint = point ?? { latitude: 33.5138, longitude: 36.2765 };

  const updatePoint = async (next: MapPoint, address?: string, googlePlaceId?: string) => {
    setMessage('جارٍ جلب عنوان نقطة التوصيل...');
    let nextAddress = address?.trim() || value.address.trim();
    let nextPlaceId = googlePlaceId ?? value.googlePlaceId;
    if (!address?.trim()) {
      try {
        const resolved = await reverseGeocodePoint(next);
        if (resolved?.address) {
          nextAddress = resolved.address;
          nextPlaceId = resolved.googlePlaceId;
        }
      } catch {
        // Preserve a manually entered address if automatic lookup is unavailable.
      }
    }
    onChange({ address: nextAddress, latitude: next.latitude, longitude: next.longitude, googlePlaceId: nextPlaceId ?? null });
    setMessage(nextAddress
      ? 'تم تحديد نقطة التوصيل وملء العنوان. راجعه قبل المتابعة.'
      : 'تم تحديد النقطة، لكن تعذر جلب العنوان تلقائياً. اكتب عنوان التوصيل في الحقل قبل المتابعة.');
  };

  const useCurrentLocation = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage('لم نتمكن من الوصول إلى موقعك. يمكنك كتابة العنوان أو تحديده من الخريطة.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await updatePoint({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    } catch {
      setMessage('تعذر تحديد موقعك الآن. يمكنك كتابة العنوان أو تحديده من الخريطة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button label="استخدام موقعي الحالي" onPress={useCurrentLocation} loading={loading} />
      <AppText variant="small" color={colors.textMuted}>سنستخدم الموقع فقط لتحديد عنوان التوصيل، ويمكنك تعديله قبل إكمال الحساب.</AppText>
      <Field label="عنوان التوصيل" multiline value={value.address} onChangeText={(address) => onChange({ ...value, address })} error={error} />
      <Pressable accessibilityRole="button" onPress={() => setShowMap((visible) => !visible)} style={({ pressed }) => [styles.mapToggle, pressed && styles.pressed]}>
        <Icon name="map-marker-outline" size={23} color={colors.primary} />
        <AppText color={colors.primary}>{showMap ? 'إغلاق الخريطة' : 'الموقع غير صحيح؟ حدده على الخريطة'}</AppText>
      </Pressable>
      {showMap ? <View style={styles.mapArea}>{!point ? <View style={styles.hint}><AppText color={colors.textMuted}>اختر النقطة على الخريطة، أو استخدم موقعك الحالي لتحديدها تلقائياً.</AppText></View> : null}<MapSelector point={mapPoint} onSelect={updatePoint} /></View> : null}
      {point ? <AppText variant="caption" color={colors.textMuted}>إحداثيات التوصيل: {point.latitude.toFixed(6)}، {point.longitude.toFixed(6)}</AppText> : null}
      {message ? <AppText accessibilityRole="alert" color={message.startsWith('تم ') ? colors.successText : colors.warningText}>{message}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  mapToggle: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 2, borderColor: colors.primary, borderRadius: 14, paddingHorizontal: spacing.md },
  hint: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.primarySoft },
  mapArea: { gap: spacing.sm },
  pressed: { opacity: 0.68 },
});
