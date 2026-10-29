/// <reference types="google.maps" />
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { colors, spacing } from '@tawreed/design-tokens';
import { AppText, Button } from '@tawreed/ui';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface ReverseGeocodeResult {
  address: string;
  googlePlaceId: string | null;
}

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;
let mapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof google !== 'undefined' && google.maps) return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tawreed-google-maps]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('MAP_LOAD_FAILED')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.dataset.tawreedGoogleMaps = 'true';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey ?? '')}&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('MAP_LOAD_FAILED'));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export async function reverseGeocodePoint(point: MapPoint): Promise<ReverseGeocodeResult | null> {
  if (!apiKey) return null;
  await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  const response = await geocoder.geocode({ location: { lat: point.latitude, lng: point.longitude } });
  const result = response.results[0];
  return result ? { address: result.formatted_address, googlePlaceId: result.place_id || null } : null;
}

export function MapSelector({ point, onSelect }: { point: MapPoint; onSelect: (point: MapPoint, address?: string, googlePlaceId?: string) => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const initialPointRef = useRef(point);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!apiKey || !hostRef.current) return;
    let active = true;
    loadGoogleMaps().then(async () => {
      if (!active || !hostRef.current) return;
      const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
      if (!active || !hostRef.current) return;
      const center = { lat: initialPointRef.current.latitude, lng: initialPointRef.current.longitude };
      const map = new Map(hostRef.current, { center, zoom: 16, streetViewControl: false, mapTypeControl: false });
      const marker = new google.maps.Marker({ map, position: center });
      mapRef.current = map;
      markerRef.current = marker;
      map.addListener('click', async (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        const selected = { latitude: event.latLng.lat(), longitude: event.latLng.lng() };
        marker.setPosition(event.latLng);
        try {
          const result = await reverseGeocodePoint(selected);
          onSelectRef.current(selected, result?.address, result?.googlePlaceId ?? undefined);
        } catch {
          onSelectRef.current(selected);
        }
      });
    }).catch(() => setFailed(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const position = { lat: point.latitude, lng: point.longitude };
    mapRef.current?.setCenter(position);
    markerRef.current?.setPosition(position);
  }, [point.latitude, point.longitude]);

  if (!apiKey || failed) {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
    return <View style={styles.fallback}><AppText color={colors.muted}>يمكنك معاينة النقطة الحالية في خرائط Google، أو كتابة العنوان الدقيق في الحقل.</AppText><Button label="فتح خرائط Google" variant="secondary" onPress={() => Linking.openURL(mapsUrl)} /></View>;
  }

  return <div ref={hostRef} aria-label="خريطة تحديد موقع التوصيل" style={{ width: '100%', height: 320, borderRadius: 16, overflow: 'hidden', border: `1px solid ${colors.line}` }} />;
}

const styles = StyleSheet.create({ fallback: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.pale } });
