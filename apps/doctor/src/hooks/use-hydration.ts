import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// Web pages are pre-rendered at build time and React hydrates them in stages: the root layout first, then each lazily
// loaded route. Anything that could make a route's first browser render differ from its HTML (window size, stored
// query cache, stored cart) must wait until that route has hydrated.

const subscribe = () => () => undefined;

// False while React is hydrating this component from the pre-rendered HTML (its server snapshot), true otherwise;
// React re-renders with the client value right after hydration. Components mounted later get true straight away.
export function useIsHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

let resolveHydrated: () => void = () => undefined;
export const pageHydrated = Platform.OS === 'web' ? new Promise<void>((resolve) => { resolveHydrated = resolve; }) : Promise.resolve();
export const markPageHydrated = () => {
  resolveHydrated();
  // Lets the brand splash in +html leave as soon as the page is live.
  if (Platform.OS === 'web' && typeof window !== 'undefined') (window as { __tawreedSplashDone?: () => void }).__tawreedSplashDone?.();
};

// Called by AppPage, which every store screen renders inside its own route: once a pre-rendered one has hydrated, the
// page is live. Screens mounted only on the client (swipe neighbours) must not signal it early.
export function useMarkPageHydrated() {
  const preRendered = useRef(!useIsHydrated());
  useEffect(() => { if (preRendered.current) markPageHydrated(); }, []);
}
