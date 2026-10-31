import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp, View } from 'react-native';

const assets = {
  horizontal: require('../../assets/brand/tawreed-horizontal-color.svg'),
  horizontalReversed: require('../../assets/brand/tawreed-horizontal-reversed.svg'),
  symbol: require('../../assets/brand/tawreed-symbol-color.svg'),
  symbolReversed: require('../../assets/brand/tawreed-symbol-reversed.svg'),
  symbolSmall: require('../../assets/brand/tawreed-symbol-small-color.svg'),
  stackedReversed: require('../../assets/brand/tawreed-stacked-reversed.svg'),
} as const;

export function BrandLogo({ variant = 'horizontal', width = 132, style }: {
  variant?: keyof typeof assets;
  width?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const ratio = variant.startsWith('horizontal') ? 3.17 : variant.startsWith('stacked') ? 1.13 : 1;
  const safeSpace = Math.max(4, Math.round(width * 0.04));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="توريد" style={{ padding: safeSpace }}>
      <Image source={assets[variant]} contentFit="contain" style={[styles.image, { width, height: width / ratio }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({ image: { flexShrink: 0 } });
