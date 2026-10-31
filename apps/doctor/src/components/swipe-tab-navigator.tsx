/* Reanimated shared values are intentionally mutated by gesture worklets. */
/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { router, usePathname } from 'expo-router';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { colors, motion } from '@tawreed/design-tokens';
import { StateView } from '@tawreed/ui';
import { GuestAuthPrompt } from './guest-auth-prompt';
import HomeScreen from '@/app/(app)/(tabs)/index';
import CatalogScreen from '@/app/(app)/(tabs)/catalog';
import CartScreen from '@/app/(app)/cart';
import OrdersScreen from '@/app/(app)/(tabs)/orders';
import AccountScreen from '@/app/(app)/(tabs)/account';
import { isMainSwipePath, mainDestinations, mainPathIndex } from '@/lib/main-navigation';
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
  const swipeEnabled = activeIndex >= 0 && isMainSwipePath(pathname);
  const [prompt, setPrompt] = useState<{ label: string; returnTo: '/orders' | '/account' } | null>(null);

  useEffect(() => {
    swipeLocked.value = false;
    translateX.value = reducedMotion ? 0 : withSpring(0, motion.spring);
  }, [pathname, reducedMotion, swipeLocked, translateX]);

  const navigate = (targetIndex: number) => {
    const destination = mainDestinations[targetIndex];
    if ('returnTo' in destination && !session) {
      translateX.value = withSpring(0, motion.spring);
      setPrompt({ label: destination.label, returnTo: destination.returnTo });
      return;
    }
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
          translateX.value = 0;
          runOnJS(navigate)(targetIndex);
        } else {
          translateX.value = withTiming(direction > 0 ? viewportWidth.value : -viewportWidth.value, { duration: motion.duration.fast }, (finished) => {
            if (finished) runOnJS(navigate)(targetIndex);
          });
        }
      } else {
        translateX.value = withSpring(0, motion.spring);
      }
    })
    .onFinalize(() => { swipeLocked.value = false; }), [activeIndex, reducedMotion, session, swipeEnabled]);

  const animatedPage = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const previousPage = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value + viewportWidth.value }] }));
  const nextPage = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value - viewportWidth.value }] }));
  const previous = activeIndex > 0 ? mainDestinations[activeIndex - 1] : null;
  const next = activeIndex < mainDestinations.length - 1 ? mainDestinations[activeIndex + 1] : null;
  const PreviousScene = previous ? scenes[activeIndex - 1] : null;
  const NextScene = next ? scenes[activeIndex + 1] : null;
  const canPreviewPrevious = PreviousScene && (!('returnTo' in previous!) || Boolean(session));
  const canPreviewNext = NextScene && (!('returnTo' in next!) || Boolean(session));

  return (
    <SwipeLockContext.Provider value={swipeLocked}>
      <View onLayout={(event) => { viewportWidth.value = event.nativeEvent.layout.width; }} style={styles.root}>
        {PreviousScene ? <Animated.View pointerEvents="none" style={[styles.adjacentPage, previousPage]}>{canPreviewPrevious ? <PreviousScene /> : <StateView title={previous!.label} message="سجّل الدخول لعرض هذا القسم." />}</Animated.View> : null}
        {NextScene ? <Animated.View pointerEvents="none" style={[styles.adjacentPage, nextPage]}>{canPreviewNext ? <NextScene /> : <StateView title={next!.label} message="سجّل الدخول لعرض هذا القسم." />}</Animated.View> : null}
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.page, animatedPage]}>{children}</Animated.View>
        </GestureDetector>
      </View>
      <GuestAuthPrompt visible={Boolean(prompt)} sectionLabel={prompt?.label ?? ''} returnTo={prompt?.returnTo ?? '/account'} onClose={() => setPrompt(null)} />
    </SwipeLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: colors.backgroundSubtle },
  page: { flex: 1, backgroundColor: colors.backgroundSubtle },
  adjacentPage: { position: 'absolute', inset: 0, backgroundColor: colors.backgroundSubtle },
});
