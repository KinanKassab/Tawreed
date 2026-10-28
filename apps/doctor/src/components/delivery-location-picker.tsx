import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { AppText, Button, Field } from '@tawreed/ui';
import { MapSelector, type MapPoint } from './map-selector';

export interface DeliveryLocationValue {
  address: string;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
}

function formatAddress(place: Location.LocationGeocodedAddress): string {
  return [place.name, place.street, place.district, place.city, place.region, place.country]
    .filter((part, index, values): part is string => Boolean(part) && values.indexOf(part) === index)
    .join('، ');
}

export function DeliveryLocationPicker({ value, error, onChange }: { value: DeliveryLocationValue; error?: string; onChange: (value: DeliveryLocationValue) => void }) {
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const point = value.latitude !== null && value.longitude !== null ? { latitude: value.latitude, longitude: value.longitude } : null;
  const mapPoint = point ?? { latitude: 33.5138, longitude: 36.2765 };

  const updatePoint = async (next: MapPoint, address?: string, googlePlaceId?: string) => {
    let nextAddress = address?.trim() || value.address;
    if (!nextAddress) {
      try {
        const places = await Location.reverseGeocodeAsync(next);
        nextAddress = places[0] ? formatAddress(places[0]) : '';
      } catch {
        nextAddress = '';
      }
    }
    onChange({ address: nextAddress, latitude: next.latitude, longitude: next.longitude, googlePlaceId: googlePlaceId ?? null });
    setMessage('تم تحديد نقطة التوصيل. راجع العنوان المكتوب قبل المتابعة.');
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
      <AppText variant="small" color={colors.muted}>سنستخدم الموقع فقط لتحديد عنوان التوصيل، ويمكنك تعديله قبل إكمال الحساب.</AppText>
      <Field label="عنوان التوصيل" multiline value={value.address} onChangeText={(address) => onChange({ ...value, address })} error={error} />
      <Pressable accessibilityRole="button" onPress={() => setShowMap((visible) => !visible)} style={({ pressed }) => [styles.mapToggle, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="map-marker-outline" size={23} color={colors.green} />
        <AppText color={colors.green}>{showMap ? 'إغلاق الخريطة' : 'الموقع غير صحيح؟ حدده على الخريطة'}</AppText>
      </Pressable>
      {showMap ? <View style={styles.mapArea}>{!point ? <View style={styles.hint}><AppText color={colors.muted}>اختر النقطة على الخريطة، أو استخدم موقعك الحالي لتحديدها تلقائياً.</AppText></View> : null}<MapSelector point={mapPoint} onSelect={updatePoint} /></View> : null}
      {point ? <AppText variant="caption" color={colors.muted}>إحداثيات التوصيل: {point.latitude.toFixed(6)}، {point.longitude.toFixed(6)}</AppText> : null}
      {message ? <AppText accessibilityRole="alert" color={message.startsWith('تم ') ? colors.successText : colors.warningText}>{message}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  mapToggle: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.green, borderRadius: 14, paddingHorizontal: spacing.md },
  hint: { padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.pale },
  mapArea: { gap: spacing.sm },
  pressed: { opacity: 0.68 },
});
