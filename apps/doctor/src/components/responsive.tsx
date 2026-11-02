import type { ReactNode } from 'react';
import { Platform, View, useWindowDimensions, type ViewProps } from 'react-native';
import { useIsHydrated } from '@/hooks/use-hydration';

type Viewport = { width: number; height: number };
type ScreenClass = 'phone' | 'tablet' | 'desktop';

// A typical screen of each class. Pre-rendered pages are built without a window, so while hydrating every class is
// rendered with its sample and the media queries in +html show only the one that fits the screen (same breakpoints).
const samples: Record<ScreenClass, Viewport> = { phone: { width: 412, height: 860 }, tablet: { width: 800, height: 1024 }, desktop: { width: 1280, height: 800 } };

export function screenClass({ width, height }: Viewport): ScreenClass {
  if (width <= 680 || (width <= 900 && height <= 500)) return 'phone';
  return width <= 900 ? 'tablet' : 'desktop';
}

const Slot = View as (props: ViewProps & { dataSet: Record<string, string> }) => ReactNode;

// Renders width-dependent UI so the pre-rendered page already fits the screen. Each copy sits in a display:contents
// wrapper; after hydration only the copy for the real screen stays (its wrapper keeps the same key, so it is kept).
export function Responsive({ children }: { children: (viewport: Viewport) => ReactNode }) {
  const window = useWindowDimensions();
  const hydrated = useIsHydrated();
  if (Platform.OS !== 'web') return children(window);
  const classes = hydrated ? [screenClass(window)] : (Object.keys(samples) as ScreenClass[]);
  return classes.map((name) => <Slot key={name} dataSet={{ viewport: name }}>{children(hydrated ? window : samples[name])}</Slot>);
}
