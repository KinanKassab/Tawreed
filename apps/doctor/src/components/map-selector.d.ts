export interface MapPoint {
  latitude: number;
  longitude: number;
}

export function MapSelector(props: {
  point: MapPoint;
  onSelect: (point: MapPoint, address?: string, googlePlaceId?: string) => void;
}): React.JSX.Element;
