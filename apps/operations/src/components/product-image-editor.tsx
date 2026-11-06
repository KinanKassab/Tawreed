import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { AppText, Button, Icon, Surface } from '@tawreed/ui';

export interface ProductImageFile {
  bytes: ArrayBuffer;
  mimeType: 'image/webp' | 'image/png' | 'image/jpeg';
  extension: 'webp' | 'png' | 'jpg';
  width: number;
  height: number;
  previewUrl: string;
}

interface ProductImageEditorProps {
  currentImageUrl: string | null;
  value: ProductImageFile | null;
  onChange: (image: ProductImageFile) => void;
  onError: (message: string) => void;
  title?: string;
  description?: string;
}

const maxBytes = 5 * 1024 * 1024;
const extensions = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' } as const;

function measure(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const element = document.createElement('img');
    element.onload = () => resolve({ width: element.naturalWidth, height: element.naturalHeight });
    element.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    element.src = url;
  });
}

/** Picks a product image and uploads it as-is (no cropping); the apps display it with contain-fit. */
export function ProductImageEditor({ currentImageUrl, value, onChange, onError, title = 'صورة المنتج', description = 'تُرفع الصورة كما هي بدون قص (JPG أو PNG أو WEBP حتى 5 ميغابايت).' }: ProductImageEditorProps) {
  const [processing, setProcessing] = useState(false);

  const chooseImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError('يجب السماح باختيار الصور من الجهاز.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setProcessing(true);
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const mimeType = (asset.mimeType ?? blob.type) as keyof typeof extensions;
      if (!(mimeType in extensions)) throw new Error('الصيغ المسموحة: JPG أو PNG أو WEBP.');
      if (blob.size > maxBytes) throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.');
      const previewUrl = URL.createObjectURL(blob);
      const size = asset.width && asset.height ? { width: asset.width, height: asset.height } : await measure(previewUrl);
      if (value?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(value.previewUrl);
      onChange({ bytes: await blob.arrayBuffer(), mimeType, extension: extensions[mimeType], width: Math.round(size.width), height: Math.round(size.height), previewUrl });
    } catch (error) {
      onError(error instanceof Error ? error.message : 'تعذر قراءة ملف الصورة.');
    } finally {
      setProcessing(false);
    }
  }, [onChange, onError, value]);

  const preview = value?.previewUrl ?? currentImageUrl;
  return (
    <Surface style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}><Icon name="image-edit-outline" size={22} color={colors.ink} /></View>
        <View style={styles.copy}>
          <AppText variant="h3">{title}</AppText>
          <AppText variant="small" color={colors.muted}>{description}</AppText>
        </View>
      </View>
      {preview ? <Image source={{ uri: preview }} resizeMode="contain" style={styles.preview} accessibilityLabel="معاينة صورة المنتج" /> : <View style={styles.empty}><Icon name="image-outline" size={44} color={colors.muted} /><AppText color={colors.muted}>لا توجد صورة حالياً</AppText></View>}
      {value ? <AppText variant="caption" color={colors.muted} style={styles.center}>{value.width}×{value.height} بكسل · {(value.bytes.byteLength / 1024 / 1024).toFixed(1)} ميغابايت</AppText> : null}
      <Button label={value ? 'اختيار صورة أخرى' : 'اختيار صورة من الجهاز'} variant="secondary" loading={processing} onPress={chooseImage} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.md },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale },
  copy: { flex: 1, gap: 2 },
  preview: { width: 144, height: 144, borderRadius: radius.md, alignSelf: 'center', backgroundColor: colors.soft },
  empty: { height: 144, borderRadius: radius.md, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  center: { textAlign: 'center' },
});
