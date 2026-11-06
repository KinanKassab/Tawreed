import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { AppText, Icon, MotionPressable } from '@tawreed/ui';

type AvatarMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export function ProfileAvatarEditor({ avatarUrl, fullName, onUpload }: {
  avatarUrl: string | null;
  fullName: string;
  onUpload: (image: { bytes: ArrayBuffer; mimeType: AvatarMimeType }) => Promise<void>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = previewUrl ?? avatarUrl;

  const chooseImage = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('يجب السماح باختيار صورة من الجهاز.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset || (asset.fileSize && asset.fileSize > 5 * 1024 * 1024)) {
      setError('حجم الصورة يجب ألا يتجاوز 5 ميغابايت.');
      return;
    }
    const mimeType: AvatarMimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType ?? '')
      ? asset.mimeType as AvatarMimeType
      : 'image/jpeg';
    setLoading(true);
    try {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('تعذر قراءة الصورة المختارة.');
      await onUpload({ bytes: await response.arrayBuffer(), mimeType });
      setPreviewUrl(asset.uri);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'تعذر رفع الصورة.');
    } finally {
      setLoading(false);
    }
  };

  return <View style={styles.editor}>
    <View style={styles.avatarShell}>
      {preview ? <Image source={preview} contentFit="cover" style={styles.avatar} accessibilityLabel={'صورة ' + fullName} /> : <Icon name="account" size={54} color={colors.primary} />}
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.onPrimary} /></View> : null}
    </View>
    <View style={styles.copy}>
      <AppText variant="h3">صورة البروفايل</AppText>
      <AppText variant="small" color={colors.textMuted}>صورة مربعة واضحة بحجم لا يتجاوز 5 ميغابايت.</AppText>
      <MotionPressable accessibilityRole="button" accessibilityLabel={preview ? 'تغيير صورة البروفايل' : 'إضافة صورة بروفايل'} disabled={loading} onPress={chooseImage} style={styles.button}>
        <Icon name="camera-outline" size={21} color={colors.primary} />
        <AppText variant="button" color={colors.primary}>{preview ? 'تغيير الصورة' : 'إضافة صورة'}</AppText>
      </MotionPressable>
      {error ? <AppText accessibilityRole="alert" variant="small" color={colors.error}>{error}</AppText> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  editor: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  avatarShell: { width: 112, height: 112, borderRadius: 56, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 3, borderColor: colors.surface },
  avatar: { width: '100%', height: '100%' },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay },
  copy: { flex: 1, minWidth: 220, gap: spacing.xs },
  button: { minHeight: 48, alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, backgroundColor: colors.surface },
});
