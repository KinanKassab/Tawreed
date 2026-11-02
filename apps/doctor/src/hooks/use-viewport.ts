import { useWindowDimensions } from 'react-native';
import { useIsHydrated } from '@/hooks/use-hydration';

const serverViewport = { width: 0, height: 0, scale: 1, fontScale: 1 };

// Pre-rendered web pages have no window at build time (width 0, the phone layout); report that size while hydrating.
export function useViewport() {
  const window = useWindowDimensions();
  return useIsHydrated() ? window : serverViewport;
}
