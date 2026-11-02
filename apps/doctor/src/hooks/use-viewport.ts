import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

const serverViewport = { width: 0, height: 0, scale: 1, fontScale: 1 };
let hydrated = Platform.OS !== 'web';

// Web pages are pre-rendered at build time, where there is no window (width 0, the phone layout). The first browser
// render must produce the same markup to hydrate, so report that size until mounted; screens mounted later get the
// real size straight away.
export function useViewport() {
  const window = useWindowDimensions();
  const [ready, setReady] = useState(hydrated);
  useEffect(() => { hydrated = true; setReady(true); }, []);
  return ready ? window : serverViewport;
}
