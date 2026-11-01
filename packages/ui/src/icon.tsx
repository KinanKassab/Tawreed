import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { iconPaths } from './icon-paths';

export type IconName = keyof typeof iconPaths;

// Drop-in replacement for MaterialCommunityIcons (same name/size/color props) rendered as inline SVG.
export function Icon({ name, size = 24, color = 'currentColor', style }: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Path d={iconPaths[name]} fill={color} /></Svg>;
}
