export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface ReverseGeocodeResult {
  address: string;
  googlePlaceId: string | null;
}

export function reverseGeocodePoint(point: MapPoint): Promise<ReverseGeocodeResult | null>;

export function MapSelector(props: {
  point: MapPoint;
  onSelect: (point: MapPoint, address?: string, googlePlaceId?: string) => void;
}): React.JSX.Element;
