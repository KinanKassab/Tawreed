/* Reanimated shared values are intentionally mutated by gesture worklets. */
/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { router, usePathname } from 'expo-router';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { colors, motion } from '@tawreed/design-tokens';
import { StateView } from '@tawreed/ui';
import { GuestAuthPrompt } from './guest-auth-prompt';
import HomeScreen from '@/app/(app)/(tabs)/index';
import CatalogScreen from '@/app/(app)/(tabs)/catalog';
import CartScreen from '@/app/(app)/cart';
import OrdersScreen from '@/app/(app)/(tabs)/orders';
import AccountScreen from '@/app/(app)/(tabs)/account';
import { isMainSwipePath, mainDestinations, mainPathIndex, swipeTransition } from '@/lib/main-navigation';
import { useIsHydrated } from '@/hooks/use-hydration';
import { useSession } from '@/providers/app-providers';

const SwipeLockContext = createContext<SharedValue<boolean> | null>(null);
const scenes = [HomeScreen, CatalogScreen, CartScreen, OrdersScreen, AccountScreen] as const;

export function SwipeExclusion({ children }: { children: ReactNode }) {
  const lock = useContext(SwipeLockContext);
  const release = () => { if (lock) setTimeout(() => { lock.value = false; }, motion.duration.instant); };
  return <View onTouchStart={() => { if (lock) lock.value = true; }} onTouchEnd={release} onTouchCancel={release}>{children}</View>;
}

export function SwipeTabNavigator({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const reducedMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const swipeLocked = useSharedValue(false);
  const viewportWidth = useSharedValue(375);
  const activeIndex = mainPathIndex(pathname);
  // Page offsets are measured from this index; it moves together with translateX so a committed swipe never jumps.
  const baseIndex = useSharedValue(activeIndex);
  const swipeEnabled = activeIndex >= 0 && isMainSwipePath(pathname);
  // Neighbours are swipe previews only. The server cannot know the screen width, so pre-rendering them at a guessed
  // offset would let one peek in at the side until hydration; they mount right after it instead.
  const hydrated = useIsHydrated();
  const [prompt, setPrompt] = useState<{ label: string; returnTo: '/orders' | '/account' } | null>(null);
  // The scene a committed swipe landed on. Its preview stays on top, exactly where the finger left it, until the real
  // route has rendered underneath, so the hand-off is invisible instead of a second open animation.
  const [handoffIndex, setHandoffIndex] = useState<number | null>(null);

  useEffect(() => {
    swipeLocked.value = false;
    translateX.value = 0;
    baseIndex.value = activeIndex;
    if (handoffIndex === null) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => { swipeTransition.active = false; setHandoffIndex(null); });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  const navigate = (targetIndex: number) => {
    const destination = mainDestinations[targetIndex];
    if ('returnTo' in destination && !session) {
      translateX.value = withSpring(0, motion.spring);
      setPrompt({ label: destination.label, returnTo: destination.returnTo });
      return;
    }
    swipeTransition.active = true;
    setHandoffIndex(targetIndex);
    router.replace(destination.href);
  };

  const pan = useMemo(() => Gesture.Pan()
    .enabled(swipeEnabled)
    .activeOffsetX([-18, 18])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (swipeLocked.value) return;
      const goingNext = event.translationX > 0;
      const atEdge = (activeIndex === 0 && !goingNext) || (activeIndex === mainDestinations.length - 1 && goingNext);
      translateX.value = event.translationX * (atEdge ? motion.swipe.edgeResistance : 1);
    })
    .onEnd((event) => {
      if (swipeLocked.value) {
        translateX.value = withSpring(0, motion.spring);
        return;
      }
      // RTL navigation: dragging right reveals the next destination.
      const direction = event.translationX > 0 ? 1 : -1;
      const targetIndex = activeIndex + direction;
      const validTarget = targetIndex >= 0 && targetIndex < mainDestinations.length;
      const committed = Math.abs(event.translationX) >= viewportWidth.value * motion.swipe.distanceRatio || Math.abs(event.velocityX) >= motion.swipe.velocity;
      if (validTarget && committed) {
        if (reducedMotion) {
          translateX.value = direction > 0 ? viewportWidth.value : -viewportWidth.value;
          runOnJS(navigate)(targetIndex);
        } else {
          // Carry the finger's release velocity into the settle so drag and finish read as one motion.
          translateX.value = withSpring(direction > 0 ? viewportWidth.value : -viewportWidth.value, { ...motion.spring, velocity: event.velocityX, overshootClamping: true }, (finished) => {
            if (finished) runOnJS(navigate)(targetIndex);
          });
        }
      } else {
        translateX.value = withSpring(0, { ...motion.spring, velocity: event.velocityX, overshootClamping: true });
      }
    })
    .onFinalize(() => { swipeLocked.value = false; }), [activeIndex, reducedMotion, session, swipeEnabled]);

  const animatedPage = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  // Keyed by scene index, so the preview a swipe lands on keeps its instance while it becomes the hand-off cover.
  const previewIndexes = hydrated ? [...new Set([
    ...(swipeEnabled ? [activeIndex - 1, activeIndex + 1] : []),
    ...(handoffIndex === null ? [] : [handoffIndex]),
  ])].filter((index) => index >= 0 && index < scenes.length) : [];

  return (
    <SwipeLockContext.Provider value={swipeLocked}>
      <View onLayout={(event) => { viewportWidth.value = event.nativeEvent.layout.width; }} style={styles.root}>
        {previewIndexes.map((index) => <ScenePreview key={index} index={index} covering={index === handoffIndex} signedIn={Boolean(session)} translateX={translateX} baseIndex={baseIndex} viewportWidth={viewportWidth} />)}
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.page, animatedPage]}>{children}</Animated.View>
        </GestureDetector>
      </View>
      <GuestAuthPrompt visible={Boolean(prompt)} sectionLabel={prompt?.label ?? ''} returnTo={prompt?.returnTo ?? '/account'} onClose={() => setPrompt(null)} />
    </SwipeLockContext.Provider>
  );
}

function ScenePreview({ index, covering, signedIn, translateX, baseIndex, viewportWidth }: {
  index: number; covering: boolean; signedIn: boolean;
  translateX: SharedValue<number>; baseIndex: SharedValue<number>; viewportWidth: SharedValue<number>;
}) {
  const position = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value + (baseIndex.value - index) * viewportWidth.value }] }));
  const destination = mainDestinations[index];
  const Scene = scenes[index];
  return <Animated.View pointerEvents="none" style={[styles.adjacentPage, covering && styles.covering, position]}>
    {!('returnTo' in destination) || signedIn ? <Scene /> : <StateView title={destination.label} message="سجّل الدخول لعرض هذا القسم." />}
  </Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: colors.backgroundSubtle },
  page: { flex: 1, backgroundColor: colors.backgroundSubtle },
  adjacentPage: { position: 'absolute', inset: 0, backgroundColor: colors.backgroundSubtle },
  covering: { zIndex: 2 },
});
