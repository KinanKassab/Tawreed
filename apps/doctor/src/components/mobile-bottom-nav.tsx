import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, motion, spacing, typography } from '@tawreed/design-tokens';
import { AppText, Icon, MotionPressable } from '@tawreed/ui';
import { GuestAuthPrompt } from './guest-auth-prompt';
import { Responsive, screenClass } from './responsive';
import { mainDestinations, mainPathIndex } from '@/lib/main-navigation';
import { useSession } from '@/providers/app-providers';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const NAV_HEIGHT = 82;
const NOTCH_TOP = 23;
const NOTCH_DEPTH = 50;
const NOTCH_HALF = 47;
const BUBBLE_SIZE = 58;

function notchCurve(center: number) {
  'worklet';
  return `C ${center - 34} ${NOTCH_TOP} ${center - 36} ${NOTCH_DEPTH} ${center - 23} ${NOTCH_DEPTH} C ${center - 14} ${NOTCH_DEPTH} ${center - 13} ${NOTCH_DEPTH + 6} ${center} ${NOTCH_DEPTH + 6} C ${center + 13} ${NOTCH_DEPTH + 6} ${center + 14} ${NOTCH_DEPTH} ${center + 23} ${NOTCH_DEPTH} C ${center + 36} ${NOTCH_DEPTH} ${center + 34} ${NOTCH_TOP} ${center + NOTCH_HALF} ${NOTCH_TOP}`;
}

function notchPath(width: number, center: number, height: number) {
  'worklet';
  return `M 0 ${NOTCH_TOP} H ${center - NOTCH_HALF} ${notchCurve(center)} H ${width} V ${height} H 0 Z`;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { session } = useSession();
  // 0 until the bar has been measured (always so in the pre-rendered page).
  const [barWidth, setBarWidth] = useState(0);
  const [prompt, setPrompt] = useState<{ label: string; returnTo: '/orders' | '/account' } | null>(null);
  const activeIndex = Math.max(0, mainPathIndex(pathname));
  const centerRatio = 1 - (activeIndex + 0.5) / mainDestinations.length;
  const centerX = useSharedValue(barWidth * centerRatio);
  const totalHeight = NAV_HEIGHT + Math.max(insets.bottom, spacing.xs);

  const animatedIndex = useRef(activeIndex);
  useEffect(() => {
    const target = barWidth * centerRatio;
    // Only a tab change animates; a new bar width (first layout after hydration, rotation) jumps straight to place.
    const tabChanged = animatedIndex.current !== activeIndex;
    animatedIndex.current = activeIndex;
    centerX.value = reducedMotion || !tabChanged ? target : withSpring(target, motion.springGentle);
  }, [activeIndex, barWidth, centerRatio, centerX, reducedMotion]);

  const pathProps = useAnimatedProps(() => ({ d: notchPath(barWidth, centerX.value, totalHeight) }));
  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: centerX.value - BUBBLE_SIZE / 2 }] }));

  const bubbleContent = <><Icon name={mainDestinations[activeIndex].activeIcon} color={colors.onPrimary} size={27} /><View style={styles.signature} /></>;
  // Before measuring, the same shape is laid out in percentages: two flat bar pieces either side of a fixed-width notch.
  const center = `${centerRatio * 100}%` as const;
  const background = barWidth ? (
    <>
      <Svg pointerEvents="none" width="100%" height={totalHeight} style={StyleSheet.absoluteFill}>
        <AnimatedPath animatedProps={pathProps} fill={colors.surface} stroke={colors.border} strokeWidth={1} />
      </Svg>
      <Animated.View pointerEvents="none" style={[styles.activeBubble, bubbleStyle]}>{bubbleContent}</Animated.View>
    </>
  ) : (
    <>
      <View pointerEvents="none" style={[styles.flatBar, { left: 0, right: `${(1 - centerRatio) * 100}%`, marginRight: NOTCH_HALF - 1 }]} />
      <View pointerEvents="none" style={[styles.flatBar, { left: center, right: 0, marginLeft: NOTCH_HALF - 1 }]} />
      <View pointerEvents="none" style={[styles.notch, { left: center, height: totalHeight }]}>
        <Svg width={NOTCH_HALF * 2} height={totalHeight}>
          <Path d={notchPath(NOTCH_HALF * 2, NOTCH_HALF, totalHeight)} fill={colors.surface} />
          <Path d={`M 0 ${NOTCH_TOP} ${notchCurve(NOTCH_HALF)}`} fill="none" stroke={colors.border} strokeWidth={1} />
        </Svg>
      </View>
      <View pointerEvents="none" style={[styles.activeBubble, { left: center, marginLeft: -BUBBLE_SIZE / 2 }]}>{bubbleContent}</View>
    </>
  );

  return (
    <Responsive>{(viewport) => screenClass(viewport) !== 'phone' ? null : (
      <>
        <View accessibilityRole="tablist" onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)} style={[styles.container, { height: totalHeight }]}>
          {background}
          <View style={[styles.items, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
            {mainDestinations.map((destination, index) => {
              const active = index === activeIndex;
              return (
                <MotionPressable
                  key={destination.label}
                  accessibilityRole="tab"
                  accessibilityLabel={destination.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    if ('returnTo' in destination && !session) setPrompt({ label: destination.label, returnTo: destination.returnTo });
                    else router.replace(destination.href);
                  }}
                  style={styles.item}
                >
                  <View style={[styles.staticIcon, active && styles.hiddenIcon]}>
                    <Icon name={destination.icon} color={colors.textMuted} size={24} />
                  </View>
                  <AppText variant="caption" color={active ? colors.primary : colors.textMuted} style={active ? styles.activeLabel : styles.label}>{destination.label}</AppText>
                </MotionPressable>
              );
            })}
          </View>
        </View>
        <GuestAuthPrompt visible={Boolean(prompt)} sectionLabel={prompt?.label ?? ''} returnTo={prompt?.returnTo ?? '/account'} onClose={() => setPrompt(null)} />
      </>
    )}</Responsive>
  );
}

const styles = StyleSheet.create({
  container: { writingDirection: 'ltr', backgroundColor: 'transparent' },
  flatBar: { position: 'absolute', top: NOTCH_TOP - 0.5, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  notch: { position: 'absolute', top: 0, width: NOTCH_HALF * 2, marginLeft: -NOTCH_HALF },
  items: { position: 'absolute', inset: 0, paddingTop: NOTCH_TOP + spacing.xs, flexDirection: 'row-reverse', alignItems: 'flex-start' },
  item: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'flex-start', gap: 1, borderRadius: 12 },
  staticIcon: { height: 26, alignItems: 'center', justifyContent: 'center' },
  hiddenIcon: { opacity: 0 },
  activeBubble: { position: 'absolute', zIndex: 3, top: 0, left: 0, width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: BUBBLE_SIZE / 2, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.backgroundSubtle },
  signature: { width: 14, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  label: { fontFamily: typography.family.medium, textAlign: 'center' },
  activeLabel: { fontFamily: typography.family.semibold, fontWeight: '600', textAlign: 'center' },
});
