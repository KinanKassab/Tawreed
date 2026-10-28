import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import { colors } from '@tawreed/design-tokens';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export function MapSelector({ point, onSelect }: { point: MapPoint; onSelect: (point: MapPoint) => void }) {
  const region: Region = {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };
  const handlePress = (event: MapPressEvent) => onSelect(event.nativeEvent.coordinate);

  return (
    <View style={styles.frame}>
      <MapView initialRegion={region} onPress={handlePress} provider={PROVIDER_GOOGLE} style={styles.map}>
        <Marker coordinate={point} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 300, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 16 },
  map: { flex: 1 },
});
