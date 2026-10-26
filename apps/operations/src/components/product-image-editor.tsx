import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Image, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { AppText, Button, Surface } from '@tawreed/ui';

export interface CroppedProductImage {
  bytes: ArrayBuffer;
  mimeType: 'image/webp';
  extension: 'webp';
  width: 1200;
  height: 1200;
  previewUrl: string;
}

interface ProductImageEditorProps {
  currentImageUrl: string | null;
  value: CroppedProductImage | null;
  onChange: (image: CroppedProductImage) => void;
  onError: (message: string) => void;
}

async function renderCrop(source: string, crop: Area): Promise<CroppedProductImage> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = document.createElement('img');
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    element.src = source;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذر تجهيز محرر الصور.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, 1200, 1200);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('تعذر تجهيز الصورة النهائية.')), 'image/webp', 0.92);
  });
  return {
    bytes: await blob.arrayBuffer(),
    mimeType: 'image/webp',
    extension: 'webp',
    width: 1200,
    height: 1200,
    previewUrl: URL.createObjectURL(blob),
  };
}

export function ProductImageEditor({ currentImageUrl, value, onChange, onError }: ProductImageEditorProps) {
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => () => {
    if (source?.startsWith('blob:')) URL.revokeObjectURL(source);
  }, [source]);

  const chooseImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError('يجب السماح باختيار الصور من الجهاز.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset || (asset.fileSize && asset.fileSize > 5 * 1024 * 1024)) {
      onError('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.');
      return;
    }
    setSource(asset.uri);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, [onError]);

  const applyCrop = useCallback(async () => {
    if (!source || !pixels) return;
    setProcessing(true);
    try {
      const next = await renderCrop(source, pixels);
      if (value?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(value.previewUrl);
      onChange(next);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'تعذر قص الصورة.');
    } finally {
      setProcessing(false);
    }
  }, [onChange, onError, pixels, source, value]);

  const preview = value?.previewUrl ?? currentImageUrl;
  return (
    <Surface style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}><MaterialCommunityIcons name="image-edit-outline" size={22} color={colors.ink} /></View>
        <View style={styles.copy}>
          <AppText variant="h3">صورة المنتج</AppText>
          <AppText variant="small" color={colors.muted}>قص مربع موحّد 1200×1200 بكسل يحافظ على تناسق العرض.</AppText>
        </View>
      </View>
      {preview ? <Image source={{ uri: preview }} resizeMode="contain" style={styles.preview} accessibilityLabel="معاينة صورة المنتج" /> : <View style={styles.empty}><MaterialCommunityIcons name="image-outline" size={44} color={colors.muted} /><AppText color={colors.muted}>لا توجد صورة حالياً</AppText></View>}
      <Button label="اختيار صورة من الجهاز" variant="secondary" onPress={chooseImage} />
      {source ? <>
        <View style={styles.cropArea} accessibilityLabel="منطقة قص الصورة">
          <Cropper image={source} crop={crop} zoom={zoom} aspect={1} cropShape="rect" showGrid onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_area, areaPixels) => setPixels(areaPixels)} />
        </View>
        <View style={styles.zoomRow}>
          <Button label="− تصغير" variant="secondary" onPress={() => setZoom((current) => Math.max(1, current - 0.2))} />
          <AppText variant="small">تكبير {Math.round(zoom * 100)}٪</AppText>
          <Button label="+ تكبير" variant="secondary" onPress={() => setZoom((current) => Math.min(3, current + 0.2))} />
        </View>
        <AppText variant="caption" color={colors.muted}>اسحب الصورة داخل الإطار، ثم استخدم التكبير والتصغير حتى تصل للقص المناسب.</AppText>
        <Button label="اعتماد القص" onPress={applyCrop} loading={processing} />
      </> : null}
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
  cropArea: { height: 320, position: 'relative', overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.deep },
  zoomRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
