import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, motion, spacing, typography } from '@tawreed/design-tokens';
import { AppText, MotionPressable } from '@tawreed/ui';
import { GuestAuthPrompt } from './guest-auth-prompt';
import { mainDestinations, mainPathIndex } from '@/lib/main-navigation';
import { useSession } from '@/providers/app-providers';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const NAV_HEIGHT = 82;
const NOTCH_TOP = 23;
const NOTCH_DEPTH = 50;
const BUBBLE_SIZE = 58;

function notchPath(width: number, center: number, height: number) {
  'worklet';
  const left = center - 47;
  const right = center + 47;
  return `M 0 ${NOTCH_TOP} H ${left} C ${center - 34} ${NOTCH_TOP} ${center - 36} ${NOTCH_DEPTH} ${center - 23} ${NOTCH_DEPTH} C ${center - 14} ${NOTCH_DEPTH} ${center - 13} ${NOTCH_DEPTH + 6} ${center} ${NOTCH_DEPTH + 6} C ${center + 13} ${NOTCH_DEPTH + 6} ${center + 14} ${NOTCH_DEPTH} ${center + 23} ${NOTCH_DEPTH} C ${center + 36} ${NOTCH_DEPTH} ${center + 34} ${NOTCH_TOP} ${right} ${NOTCH_TOP} H ${width} V ${height} H 0 Z`;
}

export function MobileBottomNav() {
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { session } = useSession();
  const [barWidth, setBarWidth] = useState(width);
  const [prompt, setPrompt] = useState<{ label: string; returnTo: '/orders' | '/account' } | null>(null);
  const activeIndex = Math.max(0, mainPathIndex(pathname));
  const centerX = useSharedValue(barWidth - (barWidth / mainDestinations.length) * (activeIndex + 0.5));
  const totalHeight = NAV_HEIGHT + Math.max(insets.bottom, spacing.xs);

  useEffect(() => {
    const target = barWidth - (barWidth / mainDestinations.length) * (activeIndex + 0.5);
    centerX.value = reducedMotion ? target : withSpring(target, motion.springGentle);
  }, [activeIndex, barWidth, centerX, reducedMotion]);

  const pathProps = useAnimatedProps(() => ({ d: notchPath(barWidth, centerX.value, totalHeight) }));
  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: centerX.value - BUBBLE_SIZE / 2 }] }));

  if (width > 680 && (width > 900 || height > 500)) return null;

  return (
    <>
      <View accessibilityRole="tablist" onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)} style={[styles.container, { height: totalHeight }]}>
        <Svg pointerEvents="none" width="100%" height={totalHeight} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={pathProps} fill={colors.surface} stroke={colors.border} strokeWidth={1} />
        </Svg>
        <Animated.View pointerEvents="none" style={[styles.activeBubble, bubbleStyle]}>
          <MaterialCommunityIcons name={mainDestinations[activeIndex].activeIcon} color={colors.onPrimary} size={27} />
          <View style={styles.signature} />
        </Animated.View>
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
                  <MaterialCommunityIcons name={destination.icon} color={colors.textMuted} size={24} />
                </View>
                <AppText variant="caption" color={active ? colors.primary : colors.textMuted} style={active ? styles.activeLabel : styles.label}>{destination.label}</AppText>
              </MotionPressable>
            );
          })}
        </View>
      </View>
      <GuestAuthPrompt visible={Boolean(prompt)} sectionLabel={prompt?.label ?? ''} returnTo={prompt?.returnTo ?? '/account'} onClose={() => setPrompt(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { writingDirection: 'ltr', backgroundColor: 'transparent' },
  items: { position: 'absolute', inset: 0, paddingTop: NOTCH_TOP + spacing.xs, flexDirection: 'row-reverse', alignItems: 'flex-start' },
  item: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'flex-start', gap: 1, borderRadius: 12 },
  staticIcon: { height: 26, alignItems: 'center', justifyContent: 'center' },
  hiddenIcon: { opacity: 0 },
  activeBubble: { position: 'absolute', zIndex: 3, top: 0, left: 0, width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: BUBBLE_SIZE / 2, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.backgroundSubtle },
  signature: { width: 14, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  label: { fontFamily: typography.family.medium, textAlign: 'center' },
  activeLabel: { fontFamily: typography.family.semibold, fontWeight: '600', textAlign: 'center' },
});
