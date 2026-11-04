import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { formatMoney, getAvailabilityLabel, type Category, type OperationsProduct, type OperationsProductGroup } from '@tawreed/domain';
import { AppText, Button, Field, Icon, Surface } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { ProductImageEditor, type ProductImageFile } from './product-image-editor';

interface ProductGroupEditorProps {
  group: OperationsProductGroup | null;
  categories: Category[];
  phone: boolean;
  compact: boolean;
  onClose: () => void;
  onEditOption: (product: OperationsProduct) => void;
  onPreview: (group: OperationsProductGroup) => void;
  onRefresh: () => Promise<unknown>;
  onFeedback: (message: string, error?: boolean) => void;
}

const errorMessages: Record<string, string> = {
  DUPLICATE_OPTION_LABEL: 'يوجد خيار بنفس الاسم ضمن هذا المنتج.',
  INVALID_OPTION_LABEL: 'اكتب اسماً للخيار (حتى 80 حرفاً).',
  INVALID_PRODUCT_NAME: 'اسم المنتج يجب أن يكون بين 2 و200 حرف.',
  INVALID_PRODUCT_DETAILS: 'تحقق من طول الحقول المدخلة.',
  PRODUCT_HAS_RESERVATIONS: 'لا يمكن أرشفة خيار عليه كمية محجوزة لطلبات قائمة.',
  VARIANT_GROUP_NOT_FOUND: 'مجموعة الخيارات غير موجودة.',
  PRODUCT_IMAGE_NOT_FOUND: 'الصورة غير موجودة.',
  CATEGORY_NOT_FOUND: 'الفئة غير موجودة.',
  STAFF_REQUIRED: 'صلاحياتك لا تسمح بهذا التعديل.',
  INVALID_UNIT_LABEL: 'اكتب وحدة البيع (حتى 80 حرفاً).',
};

export function operationsErrorMessage(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const code = Object.keys(errorMessages).find((key) => message.includes(key));
  return code ? errorMessages[code] : 'تعذر حفظ التعديل. حاول مجدداً.';
}

export function ProductGroupEditor({ group, categories, phone, compact, onClose, onEditOption, onPreview, onRefresh, onFeedback }: ProductGroupEditorProps) {
  const data = useData();
  const lead = group?.options.find((option) => option.active) ?? group?.options[0] ?? null;
  const grouped = Boolean(group?.variantGroupKey);
  // The parent remounts this editor per product (key), so initial state comes from the lead option.
  const [details, setDetails] = useState(() => ({ nameAr: lead?.nameAr ?? '', manufacturer: lead?.manufacturer ?? '', descriptionAr: lead?.descriptionAr ?? '', specificationsAr: lead?.specificationsAr ?? '', categoryId: lead?.category?.id ?? '' }));
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState('');
  const [sourceLabel, setSourceLabel] = useState(lead?.packageLabelAr ?? '');
  const [galleryOptionId, setGalleryOptionId] = useState<string | null>(null);
  const [unit, setUnit] = useState(lead?.unitLabelAr ?? '');
  const [image, setImage] = useState<ProductImageFile | null>(null);
  const labelOf = (option: OperationsProduct) => labelDrafts[option.id] ?? option.variantLabelAr ?? '';

  const run = useMutation({
    mutationFn: async (action: { task: () => Promise<unknown>; success: string }) => { await action.task(); return action.success; },
    onSuccess: async (success) => { await onRefresh(); onFeedback(success); },
    onError: (error) => onFeedback(operationsErrorMessage(error), true),
  });
  const perform = (task: () => Promise<unknown>, success: string) => run.mutate({ task, success });

  if (!group || !lead || !data) return null;
  const operations = data.operations;
  const galleryOption = group.options.find((option) => option.id === galleryOptionId) ?? group.options[0];
  const activeOptions = group.options.filter((option) => option.active);
  const distinctUnits = [...new Set(group.options.map((option) => option.unitLabelAr))];

  const move = (index: number, direction: -1 | 1) => {
    const order = group.options.map((option) => option.id);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    perform(() => operations.reorderProductOptions(group.variantGroupKey!, order), 'تم تحديث ترتيب الخيارات.');
  };
  const moveImage = (index: number, direction: -1 | 1) => {
    const order = galleryOption.gallery.map((asset) => asset.id);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    perform(() => operations.reorderProductImages(galleryOption.id, order), 'تم تحديث ترتيب الصور.');
  };
  const uploadImage = (makePrimary: boolean) => {
    if (!image) return;
    const upload = image;
    perform(async () => {
      await operations.addProductImage(galleryOption.id, upload, makePrimary);
      if (upload.previewUrl.startsWith('blob:')) URL.revokeObjectURL(upload.previewUrl);
      setImage(null);
    }, makePrimary ? 'تم رفع الصورة وتعيينها كصورة رئيسية.' : 'تمت إضافة الصورة إلى المعرض.');
  };
  const close = () => {
    if (image?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    onClose();
  };

  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <View style={[styles.overlay, phone && styles.overlayPhone]}>
      <Surface style={phone ? [styles.modal, styles.modalPhone] : styles.modal} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="h2">إدارة المنتج</AppText>
            <AppText variant="small" color={colors.muted}>{grouped ? `${activeOptions.length.toLocaleString('ar-SY')} خيار نشط من ${group.options.length.toLocaleString('ar-SY')}` : 'منتج بدون خيارات'}</AppText>
          </View>
          <Button label="معاينة كما يراها الطبيب" variant="secondary" onPress={() => onPreview(group)} />
          <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={close} style={styles.iconButton}><Icon name="close" size={24} color={colors.ink} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="المعلومات المشتركة" hint={grouped ? 'تُطبّق على كل خيارات هذا المنتج دفعة واحدة.' : 'لمنتج بدون خيارات تُعدّل هذه المعلومات من "تعديل الخيار".'}>
            {grouped ? <>
              <Field label="اسم المنتج" value={details.nameAr} onChangeText={(nameAr) => setDetails((current) => ({ ...current, nameAr }))} />
              <Field label="الشركة المصنعة" value={details.manufacturer} onChangeText={(manufacturer) => setDetails((current) => ({ ...current, manufacturer }))} />
              <CategoryPicker categories={categories} value={details.categoryId} onChange={(categoryId) => setDetails((current) => ({ ...current, categoryId }))} />
              <Field label="الوصف الظاهر في تطبيق الدكتور" multiline numberOfLines={4} value={details.descriptionAr} onChangeText={(descriptionAr) => setDetails((current) => ({ ...current, descriptionAr }))} />
              <Field label="المواصفات" multiline numberOfLines={3} value={details.specificationsAr} onChangeText={(specificationsAr) => setDetails((current) => ({ ...current, specificationsAr }))} />
              <Button label="حفظ المعلومات المشتركة" loading={run.isPending} disabled={!details.categoryId} onPress={() => perform(() => operations.updateGroupDetails({ groupKey: group.variantGroupKey!, ...details }), 'تم حفظ المعلومات لكل الخيارات.')} />
            </> : <View style={styles.inlineRow}>
              <AppText style={styles.flex}>{lead.nameAr} · {lead.category?.nameAr ?? 'بدون فئة'}</AppText>
              <Button label="تعديل المنتج" onPress={() => onEditOption(lead)} />
            </View>}
          </Section>

          <Section title="وحدة البيع" hint={grouped ? 'الوحدة التي يُسعَّر ويُطلب بها كل خيار. تُطبّق هنا على كل الخيارات، ويمكن تغييرها لخيار واحد من "تعديل السعر والمخزون".' : 'الوحدة التي يُسعَّر ويُطلب بها المنتج.'}>
            {distinctUnits.length > 1 ? <AppText variant="caption" color={colors.warningText}>الخيارات حالياً بوحدات مختلفة: {distinctUnits.join('، ')}</AppText> : null}
            <UnitPicker value={unit} onChange={setUnit} />
            <Button label={grouped ? 'تطبيق الوحدة على كل الخيارات' : 'حفظ وحدة البيع'} loading={run.isPending} disabled={!unit.trim() || (distinctUnits.length === 1 && distinctUnits[0] === unit.trim())} onPress={() => perform(() => operations.setUnitLabel(group.options.map((option) => option.id), unit), grouped ? 'تم تغيير وحدة البيع لكل الخيارات.' : 'تم تغيير وحدة البيع.')} />
          </Section>

          <Section title="الخيارات (النوع / العبوة / الحجم)" hint="كل خيار له سعره وتكلفته ومخزونه وصوره. الطبيب يختار بينها داخل نفس المنتج.">
            {grouped ? group.options.map((option, index) => <View key={option.id} style={[styles.optionRow, !option.active && styles.optionArchived, compact && styles.optionRowCompact]}>
              <Thumb url={data.media.resolve(option.media)} />
              <View style={styles.optionLabel}>
                <Field label="اسم الخيار" value={labelOf(option)} onChangeText={(value) => setLabelDrafts((current) => ({ ...current, [option.id]: value }))} />
                <AppText variant="caption" color={colors.muted}>{option.sku}{option.active ? '' : ' · مؤرشف'}</AppText>
              </View>
              <View style={styles.optionMetrics}>
                <Metric label="البيع" value={option.price ? formatMoney(option.price) : 'بدون سعر'} warn={!option.price} />
                <Metric label="الوحدة" value={option.unitLabelAr} />
                <Metric label="التكلفة" value={option.cost ? formatMoney(option.cost) : '—'} />
                <Metric label="المتاح" value={(option.onHand - option.reserved).toLocaleString('ar-SY')} />
                <Metric label="العرض" value={getAvailabilityLabel(option.availability)} />
                <Metric label="الصور" value={option.gallery.length.toLocaleString('ar-SY')} warn={!option.gallery.length} />
              </View>
              <View style={styles.optionActions}>
                {labelOf(option) !== (option.variantLabelAr ?? '') ? <Button label="حفظ الاسم" onPress={() => perform(async () => {
                  await operations.setProductOption({ productId: option.id, groupKey: group.variantGroupKey, labelAr: labelOf(option) });
                  setLabelDrafts(({ [option.id]: _saved, ...rest }) => rest);
                }, 'تم تغيير اسم الخيار.')} /> : null}
                <Button label="تعديل السعر والمخزون" variant="secondary" onPress={() => onEditOption(option)} />
                <Button label="↑" variant="secondary" disabled={index === 0 || run.isPending} onPress={() => move(index, -1)} />
                <Button label="↓" variant="secondary" disabled={index === group.options.length - 1 || run.isPending} onPress={() => move(index, 1)} />
                <Button label={option.active ? 'أرشفة' : 'استعادة'} variant="secondary" onPress={() => perform(() => operations.setProductActive(option.id, !option.active), option.active ? 'تمت أرشفة الخيار وإخفاؤه عن الأطباء.' : 'تمت استعادة الخيار.')} />
                {group.options.length > 1 ? <Button label="فصل كمنتج مستقل" variant="text" onPress={() => perform(() => operations.setProductOption({ productId: option.id, groupKey: null, labelAr: null }), 'تم فصل الخيار كمنتج مستقل.')} /> : null}
              </View>
            </View>) : <View style={styles.optionRow}>
              <Thumb url={data.media.resolve(lead.media)} />
              <View style={styles.flex}><AppText>{lead.sku}</AppText><AppText variant="caption" color={colors.muted}>{lead.price ? formatMoney(lead.price) : 'بدون سعر'} · متاح {(lead.onHand - lead.reserved).toLocaleString('ar-SY')}</AppText></View>
              <Button label={lead.active ? 'أرشفة' : 'استعادة'} variant="secondary" onPress={() => perform(() => operations.setProductActive(lead.id, !lead.active), lead.active ? 'تمت أرشفة المنتج.' : 'تمت استعادة المنتج.')} />
            </View>}
            <Surface style={styles.addOption}>
              <AppText variant="small" style={styles.semibold}>{grouped ? 'إضافة خيار جديد' : 'تحويل إلى منتج بخيارات'}</AppText>
              {!grouped ? <Field label="اسم الخيار الحالي" placeholder="مثال: عبوة صغيرة" value={sourceLabel} onChangeText={setSourceLabel} /> : null}
              <Field label="اسم الخيار الجديد" placeholder="مثال: عبوة كبيرة، أزرق، 25 مم" value={newLabel} onChangeText={setNewLabel} />
              <AppText variant="caption" color={colors.muted}>ينسخ الخيار الجديد الاسم والوصف والصور، ويبدأ بدون سعر وبمخزون صفر حتى تعدّله.</AppText>
              <Button label="إضافة الخيار" loading={run.isPending} disabled={!newLabel.trim() || (!grouped && !sourceLabel.trim())} onPress={() => perform(async () => {
                await operations.addProductOption({ sourceProductId: lead.id, labelAr: newLabel, sourceLabelAr: grouped ? undefined : sourceLabel });
                setNewLabel('');
              }, 'تمت إضافة الخيار. حدّد سعره ومخزونه ليظهر للأطباء.')} />
            </Surface>
          </Section>

          <Section title="الصور" hint="الصورة الرئيسية هي التي تظهر للطبيب. يمكن لكل خيار أن يحمل صوره الخاصة.">
            {group.options.length > 1 ? <View style={styles.chips}>{group.options.map((option) => <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected: option.id === galleryOption.id }} onPress={() => setGalleryOptionId(option.id)} style={[styles.chip, option.id === galleryOption.id && styles.chipSelected]}><AppText variant="small" color={option.id === galleryOption.id ? colors.white : colors.ink}>{option.variantLabelAr ?? option.sku}</AppText></Pressable>)}</View> : null}
            <View style={styles.gallery}>
              {galleryOption.gallery.map((asset, index) => <Surface key={asset.id} style={styles.galleryItem}>
                <Image source={{ uri: data.media.resolve(asset) ?? undefined }} resizeMode="contain" style={styles.galleryImage} accessibilityLabel={asset.altTextAr} />
                {asset.isPrimary ? <View style={styles.primaryBadge}><AppText variant="caption" color={colors.white}>رئيسية</AppText></View> : <Button label="اجعلها رئيسية" variant="secondary" onPress={() => perform(() => operations.setPrimaryProductImage(galleryOption.id, asset.id), 'تم تعيين الصورة الرئيسية.')} />}
                <View style={styles.inlineRow}>
                  <Button label="→" variant="text" disabled={index === 0} onPress={() => moveImage(index, -1)} />
                  <Button label="حذف" variant="text" onPress={() => perform(() => operations.removeProductImage(galleryOption.id, asset.id), 'تمت إزالة الصورة من هذا الخيار.')} />
                  <Button label="←" variant="text" disabled={index === galleryOption.gallery.length - 1} onPress={() => moveImage(index, 1)} />
                </View>
              </Surface>)}
              {!galleryOption.gallery.length ? <View style={styles.galleryEmpty}><Icon name="image-off-outline" size={32} color={colors.muted} /><AppText variant="small" color={colors.muted}>لا توجد صور لهذا الخيار</AppText></View> : null}
            </View>
            {grouped && galleryOption.gallery.length > 0 && group.options.length > 1 ? <Button label="تطبيق صور هذا الخيار على كل الخيارات" variant="secondary" onPress={() => perform(() => operations.copyProductImagesToGroup(galleryOption.id), 'تم نسخ الصور لكل خيارات المنتج.')} /> : null}
            <ProductImageEditor currentImageUrl={null} value={image} onChange={setImage} onError={(message) => onFeedback(message, true)} />
            {image ? <View style={styles.inlineRow}>
              <Button label="رفع كصورة رئيسية" loading={run.isPending} onPress={() => uploadImage(true)} />
              <Button label="إضافة للمعرض" variant="secondary" loading={run.isPending} onPress={() => uploadImage(false)} />
            </View> : null}
          </Section>
        </ScrollView>
      </Surface>
    </View>
  </Modal>;
}

const commonUnits = ['قطعة', 'علبة', 'عبوة', 'باكيت', 'كرتونة', 'طقم', 'زوج', 'لفة', 'ليتر', 'كيلو'];

/** Free-text sales unit with one-tap common choices. */
export function UnitPicker({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  return <View style={styles.fieldGroup}>
    <Field label="وحدة البيع" placeholder="مثال: قطعة، علبة 50 قطعة" value={value} onChangeText={onChange} error={error} />
    <View style={styles.chips}>{commonUnits.map((unit) => { const selected = value.trim() === unit; return <Pressable key={unit} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(unit)} style={[styles.chip, selected && styles.chipSelected]}><AppText variant="small" color={selected ? colors.white : colors.ink}>{unit}</AppText></Pressable>; })}</View>
  </View>;
}

export function CategoryPicker({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (id: string) => void }) {
  return <View style={styles.fieldGroup}>
    <AppText variant="small">الفئة</AppText>
    <View style={styles.chips}>{categories.map((category) => <Pressable key={category.id} accessibilityRole="radio" accessibilityState={{ selected: category.id === value }} onPress={() => onChange(category.id)} style={[styles.chip, category.id === value && styles.chipSelected]}><AppText variant="small" color={category.id === value ? colors.white : colors.ink}>{category.nameAr}</AppText></Pressable>)}</View>
  </View>;
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return <View style={styles.section}><View><AppText variant="h3">{title}</AppText><AppText variant="caption" color={colors.muted}>{hint}</AppText></View>{children}</View>;
}
function Thumb({ url }: { url: string | null }) {
  return url ? <Image source={{ uri: url }} style={styles.thumb} resizeMode="contain" /> : <View style={styles.thumb}><Icon name="image-outline" size={22} color={colors.muted} /></View>;
}
function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <View style={[styles.metric, warn && styles.metricWarn]}><AppText variant="caption" color={colors.muted}>{label}</AppText><AppText variant="small" color={warn ? colors.warningText : colors.ink}>{value}</AppText></View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, padding: spacing.md, alignItems: 'center', justifyContent: 'center' }, overlayPhone: { padding: 0, justifyContent: 'flex-end' },
  modal: { width: '100%', maxWidth: 1180, maxHeight: '94%', gap: spacing.md, padding: spacing.lg }, modalPhone: { maxHeight: '100%', height: '100%', borderRadius: 0, padding: spacing.md },
  header: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }, flex: { flex: 1, minWidth: 0 },
  iconButton: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  content: { gap: spacing.xl, paddingBottom: spacing.lg }, section: { gap: spacing.md }, fieldGroup: { gap: spacing.xs },
  inlineRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  optionRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white },
  optionRowCompact: { alignItems: 'stretch' }, optionArchived: { opacity: 0.6, backgroundColor: colors.soft },
  optionLabel: { width: 220, maxWidth: '100%', gap: 2 }, optionMetrics: { flex: 1, minWidth: 260, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs },
  optionActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs, maxWidth: '100%' },
  metric: { minWidth: 84, backgroundColor: colors.soft, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 }, metricWarn: { backgroundColor: colors.warningSurface },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  addOption: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.pale },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.deep, borderColor: colors.deep },
  gallery: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  galleryItem: { width: 176, gap: spacing.xs, padding: spacing.sm, alignItems: 'center' }, galleryImage: { width: 150, height: 150, borderRadius: radius.sm, backgroundColor: colors.soft },
  galleryEmpty: { width: 176, height: 150, borderRadius: radius.md, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  primaryBadge: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.successText },
  semibold: { fontFamily: typography.family.semibold, fontWeight: '600' },
});
