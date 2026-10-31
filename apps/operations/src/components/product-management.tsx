import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { formatMoney, getAvailabilityLabel, normalizeAppError, roundSypTo50, type Availability, type OperationsProduct } from '@tawreed/domain';
import { AppText, Button, Field, StateView, Surface } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { ProductImageEditor, type CroppedProductImage } from './product-image-editor';

const optionalMoney = z.string().trim().refine((value) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 10_000_000_000), 'أدخل سعراً موجباً أو اتركه فارغاً.');
const productSchema = z.object({
  nameAr: z.string().trim().min(2, 'اسم المنتج قصير جداً.').max(200, 'اسم المنتج طويل جداً.'),
  manufacturer: z.string().max(200, 'اسم الشركة طويل جداً.'),
  unitLabelAr: z.string().trim().min(1, 'أدخل وحدة البيع.').max(80, 'وحدة البيع طويلة جداً.'),
  packageLabelAr: z.string().max(120, 'وصف العبوة طويل جداً.'),
  sellingPrice: optionalMoney,
  cost: optionalMoney,
  onHand: z.string().trim().refine((value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100_000_000, 'أدخل كمية صحيحة غير سالبة.'),
  lowStockThreshold: z.string().trim().refine((value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 1_000_000, 'أدخل حداً صحيحاً غير سالب.'),
  descriptionAr: z.string().max(5000, 'الوصف طويل جداً.'),
  specificationsAr: z.string().max(5000, 'المواصفات طويلة جداً.'),
  inventoryNotes: z.string().max(500, 'ملاحظة المخزون طويلة جداً.'),
  availability: z.enum(['available', 'limited', 'unavailable']),
});
type ProductForm = z.infer<typeof productSchema>;

interface ProductManagementProps {
  products: OperationsProduct[];
  loading: boolean;
  compact: boolean;
  phone: boolean;
  search: string;
  onSearch: (value: string) => void;
  onRefresh: () => Promise<unknown>;
  onFeedback: (message: string, error?: boolean) => void;
}

const moneyText = (value: OperationsProduct['price']) => value?.currency === 'NEW_SYP' ? String(value.amountMinor) : '';
const sypText = (value: number) => formatMoney({ amountMinor: roundSypTo50(value), currency: 'NEW_SYP', decimalPlaces: 0 });
const stockState = (product: Pick<OperationsProduct, 'onHand' | 'reserved' | 'lowStockThreshold'>) => {
  const available = product.onHand - product.reserved;
  if (available <= 0) return { label: 'نافد', icon: 'close-circle-outline' as const, background: colors.unavailableSurface, color: colors.danger };
  if (available <= product.lowStockThreshold) return { label: 'أوشك على النفاد', icon: 'alert-circle-outline' as const, background: colors.warningSurface, color: colors.warningText };
  return { label: 'متوفر', icon: 'check-circle-outline' as const, background: colors.successSurface, color: colors.successText };
};

export function ProductManagement({ products, loading, compact, phone, search, onSearch, onRefresh, onFeedback }: ProductManagementProps) {
  const data = useData();
  const [editing, setEditing] = useState<OperationsProduct | null>(null);
  const [previewing, setPreviewing] = useState<OperationsProduct | null>(null);
  const [draftPreview, setDraftPreview] = useState<ProductForm | null>(null);
  const [image, setImage] = useState<CroppedProductImage | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { nameAr: '', manufacturer: '', unitLabelAr: 'قطعة', packageLabelAr: '', sellingPrice: '', cost: '', onHand: '0', lowStockThreshold: '5', descriptionAr: '', specificationsAr: '', inventoryNotes: '', availability: 'unavailable' },
  });
  const watchedSelling = useWatch({ control: form.control, name: 'sellingPrice' });
  const watchedCost = useWatch({ control: form.control, name: 'cost' });
  const profit = watchedSelling !== '' && watchedCost !== '' ? Number(watchedSelling) - Number(watchedCost) : null;
  const visibleProducts = products.slice(0, visibleCount);

  const openEditor = (product: OperationsProduct) => {
    if (image?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
    form.reset({
      nameAr: product.nameAr,
      manufacturer: product.manufacturer ?? '',
      unitLabelAr: product.unitLabelAr,
      packageLabelAr: product.packageLabelAr ?? '',
      sellingPrice: moneyText(product.price),
      cost: moneyText(product.cost),
      onHand: String(product.onHand),
      lowStockThreshold: String(product.lowStockThreshold),
      descriptionAr: product.descriptionAr ?? '',
      specificationsAr: product.specificationsAr ?? '',
      inventoryNotes: '',
      availability: product.availability,
    });
    setImage(null);
    setEditing(product);
  };
  const closeEditor = () => {
    if (image?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    setDraftPreview(null);
    setEditing(null);
  };

  const save = useMutation({
    mutationFn: async (values: ProductForm) => {
      if (!data || !editing) return;
      const onHand = Number(values.onHand);
      if (onHand < editing.reserved) throw new Error('لا يمكن جعل الكمية أقل من الكمية المحجوزة للطلبات.');
      await data.operations.updateProduct({
        productId: editing.id,
        nameAr: values.nameAr,
        manufacturer: values.manufacturer,
        unitLabelAr: values.unitLabelAr,
        packageLabelAr: values.packageLabelAr,
        descriptionAr: values.descriptionAr,
        specificationsAr: values.specificationsAr,
        availability: values.availability,
        lowStockThreshold: Number(values.lowStockThreshold),
        sellingPriceMinor: values.sellingPrice === '' ? null : roundSypTo50(Number(values.sellingPrice)),
        costMinor: values.cost === '' ? null : roundSypTo50(Number(values.cost)),
        currency: 'NEW_SYP',
        decimalPlaces: 0,
        onHand,
        inventoryNotes: values.inventoryNotes,
        image: image ? { bytes: image.bytes, mimeType: image.mimeType, extension: image.extension, width: image.width, height: image.height } : undefined,
      });
    },
    onSuccess: async () => {
      await onRefresh();
      closeEditor();
      onFeedback('تم حفظ معلومات المنتج وصورته بنجاح.');
    },
    onError: (error) => onFeedback(error instanceof Error && error.message.startsWith('لا يمكن') ? error.message : normalizeAppError(error).messageAr, true),
  });

  const showDraftPreview = form.handleSubmit((values) => setDraftPreview(values));
  const currentImage = editing && data ? data.media.resolve(editing.media) : null;

  if (loading) return <StateView loading title="جاري تحميل المنتجات" message="لحظات قليلة." />;
  return <View style={styles.page}>
    <View style={styles.toolbar}>
      <View style={styles.search}><Field label="بحث بالاسم أو SKU" placeholder="ابحث ضمن المنتجات" value={search} onChangeText={(value) => { setVisibleCount(40); onSearch(value); }} /></View>
      <View style={styles.legend}>
        <StockLegend color={colors.successText} label="متوفر" />
        <StockLegend color={colors.warningText} label="قرب النفاد" />
        <StockLegend color={colors.danger} label="نافد" />
      </View>
    </View>
    <ScrollView horizontal={!compact} contentContainerStyle={styles.tableScroll}>
      <View style={[styles.table, !compact && styles.tableDesktop]}>
        {!compact ? <View style={styles.headerRow}>
          <HeaderCell label="المنتج" style={styles.productColumn} />
          <HeaderCell label="سعر البيع" />
          <HeaderCell label="التكلفة" />
          <HeaderCell label="الربح/قطعة" />
          <HeaderCell label="المخزون" />
          <HeaderCell label="الوصف" style={styles.descriptionColumn} />
          <HeaderCell label="الإجراءات" style={styles.actionColumn} />
        </View> : null}
        {visibleProducts.map((product) => <ProductTableRow key={product.id} product={product} compact={compact} imageUrl={data?.media.resolve(product.media) ?? null} onEdit={() => openEditor(product)} onPreview={() => setPreviewing(product)} />)}
        {!products.length ? <StateView title="لا توجد نتائج" message="جرّب تغيير عبارة البحث." /> : null}
      </View>
    </ScrollView>
    {visibleCount < products.length ? <View style={styles.loadMore}><AppText variant="small" color={colors.muted}>يظهر {visibleProducts.length.toLocaleString('ar-SY')} من {products.length.toLocaleString('ar-SY')} منتج</AppText><Button label="عرض المزيد" variant="secondary" onPress={() => setVisibleCount((count) => count + 40)} /></View> : null}

    <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={closeEditor}>
      <View style={[styles.overlay, phone && styles.overlayPhone]}>
        <Surface style={phone ? [styles.editorModal, styles.editorModalPhone] : styles.editorModal} accessibilityViewIsModal>
          <View style={styles.modalHeader}>
            <View><AppText variant="h2">تعديل المنتج</AppText><AppText variant="small" color={colors.muted}>{editing?.sku}</AppText></View>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق التعديل" onPress={closeEditor} style={styles.iconButton}><MaterialCommunityIcons name="close" size={24} color={colors.ink} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.formGrid, compact && styles.formGridCompact]}>
              <View style={styles.formColumn}>
                <Controller control={form.control} name="nameAr" render={({ field, fieldState }) => <Field label="اسم المنتج" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                <Controller control={form.control} name="manufacturer" render={({ field, fieldState }) => <Field label="الشركة المصنعة" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                <View style={styles.twoColumns}>
                  <View style={styles.flexField}><Controller control={form.control} name="unitLabelAr" render={({ field, fieldState }) => <Field label="وحدة البيع" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                  <View style={styles.flexField}><Controller control={form.control} name="packageLabelAr" render={({ field, fieldState }) => <Field label="النوع أو العبوة" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                </View>
                <View style={styles.twoColumns}>
                  <View style={styles.flexField}><Controller control={form.control} name="sellingPrice" render={({ field, fieldState }) => <Field label="سعر البيع (SYP)" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} onBlur={() => { field.onBlur(); if (field.value !== '') field.onChange(String(roundSypTo50(Number(field.value)))); }} error={fieldState.error?.message} />} /></View>
                  <View style={styles.flexField}><Controller control={form.control} name="cost" render={({ field, fieldState }) => <Field label="سعر التكلفة (SYP)" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} onBlur={() => { field.onBlur(); if (field.value !== '') field.onChange(String(roundSypTo50(Number(field.value)))); }} error={fieldState.error?.message} />} /></View>
                </View>
                <View style={[styles.profit, profit !== null && profit < 0 && styles.profitLoss]}><AppText variant="small" color={profit !== null && profit < 0 ? colors.danger : colors.successText}>الربح لكل قطعة: {profit === null ? 'أدخل السعر والتكلفة' : sypText(profit)}</AppText><AppText variant="caption" color={colors.muted}>تُجبر الأسعار تلقائياً إلى أقرب 50 ليرة.</AppText></View>
                <View style={styles.twoColumns}>
                  <View style={styles.flexField}><Controller control={form.control} name="onHand" render={({ field, fieldState }) => <Field label="الكمية الموجودة" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                  <View style={styles.flexField}><Controller control={form.control} name="lowStockThreshold" render={({ field, fieldState }) => <Field label="حد التنبيه" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                </View>
                {editing ? <AppText variant="caption" color={colors.muted}>المحجوز حالياً: {editing.reserved.toLocaleString('ar-SY')} — لا يمكن خفض الموجود عن المحجوز.</AppText> : null}
                <Controller control={form.control} name="descriptionAr" render={({ field, fieldState }) => <Field label="الوصف الظاهر في تطبيق الدكتور" multiline numberOfLines={5} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                <Controller control={form.control} name="specificationsAr" render={({ field, fieldState }) => <Field label="المواصفات والخيارات" multiline numberOfLines={4} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                <Controller control={form.control} name="inventoryNotes" render={({ field, fieldState }) => <Field label="سبب تعديل المخزون (عند تغيير الكمية)" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                <Controller control={form.control} name="availability" render={({ field }) => <View style={styles.fieldGroup}><AppText variant="small">حالة العرض</AppText><View style={styles.availability}>{(['available', 'limited', 'unavailable'] as const).map((item) => <Button key={item} label={getAvailabilityLabel(item)} variant={field.value === item ? 'primary' : 'secondary'} onPress={() => field.onChange(item)} />)}</View></View>} />
              </View>
              <View style={styles.imageColumn}>{editing ? <ProductImageEditor currentImageUrl={currentImage} value={image} onChange={setImage} onError={(message) => onFeedback(message, true)} /> : null}</View>
            </View>
          </ScrollView>
          <View style={[styles.modalActions, phone && styles.modalActionsPhone]}>
            <Button label="إلغاء التعديلات" variant="secondary" onPress={closeEditor} style={phone ? styles.modalActionPhone : undefined} />
            <Button label="معاينة المنتج" variant="secondary" onPress={showDraftPreview} style={phone ? styles.modalActionPhone : undefined} />
            <Button label="حفظ التغييرات" onPress={form.handleSubmit((values) => save.mutate(values))} loading={save.isPending} style={phone ? styles.modalActionPhone : undefined} />
          </View>
        </Surface>
      </View>
    </Modal>

    <ProductPreview product={previewing} imageUrl={previewing && data ? data.media.resolve(previewing.media) : null} onClose={() => setPreviewing(null)} phone={phone} />
    <DraftProductPreview product={editing} values={draftPreview} imageUrl={image?.previewUrl ?? currentImage} onClose={() => setDraftPreview(null)} phone={phone} />
  </View>;
}

function ProductTableRow({ product, compact, imageUrl, onEdit, onPreview }: { product: OperationsProduct; compact: boolean; imageUrl: string | null; onEdit: () => void; onPreview: () => void }) {
  const stock = stockState(product);
  const profit = product.price && product.cost ? product.price.amountMinor - product.cost.amountMinor : null;
  if (compact) return <Surface style={styles.mobileCard}>
    <View style={styles.mobileTitle}>{imageUrl ? <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="contain" /> : <View style={styles.thumbnailPlaceholder}><MaterialCommunityIcons name="image-outline" size={24} color={colors.muted} /></View>}<View style={styles.productName}><AppText style={styles.semibold}>{product.nameAr}</AppText><AppText variant="caption" color={colors.muted}>{product.sku}</AppText></View><StockBadge {...stock} /></View>
    <View style={styles.mobileMetrics}><Metric label="البيع" value={product.price ? formatMoney(product.price) : '—'} /><Metric label="التكلفة" value={product.cost ? formatMoney(product.cost) : '—'} /><Metric label="الربح" value={profit === null || !product.price ? '—' : formatMoney({ amountMinor: profit, currency: product.price.currency, decimalPlaces: product.price.decimalPlaces })} /><Metric label="المتاح / التنبيه" value={`${product.onHand - product.reserved} / ${product.lowStockThreshold}`} /></View>
    <AppText variant="small" color={colors.muted} numberOfLines={2}>{product.descriptionAr || 'لا يوجد وصف بعد.'}</AppText>
    <View style={styles.rowActions}><Button label="تعديل" onPress={onEdit} style={styles.cardAction} /><Button label="معاينة المنتج" variant="secondary" onPress={onPreview} style={styles.cardAction} /></View>
  </Surface>;
  return <View style={styles.dataRow}>
    <View style={[styles.cell, styles.productColumn, styles.productCell]}>{imageUrl ? <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="contain" /> : <View style={styles.thumbnailPlaceholder}><MaterialCommunityIcons name="image-outline" size={24} color={colors.muted} /></View>}<View style={styles.productName}><AppText variant="small" style={styles.semibold} numberOfLines={2}>{product.nameAr}</AppText><AppText variant="caption" color={colors.muted}>{product.sku}</AppText></View></View>
    <View style={styles.cell}><AppText variant="small">{product.price ? formatMoney(product.price) : '—'}</AppText></View>
    <View style={styles.cell}><AppText variant="small">{product.cost ? formatMoney(product.cost) : '—'}</AppText></View>
    <View style={styles.cell}><AppText variant="small" color={profit !== null && profit < 0 ? colors.danger : colors.successText}>{profit === null || !product.price ? '—' : formatMoney({ amountMinor: profit, currency: product.price.currency, decimalPlaces: product.price.decimalPlaces })}</AppText></View>
    <View style={styles.cell}><StockBadge {...stock} /><AppText variant="caption" color={colors.muted}>متاح {product.onHand - product.reserved} · حد {product.lowStockThreshold}</AppText></View>
    <View style={[styles.cell, styles.descriptionColumn]}><AppText variant="small" color={colors.muted} numberOfLines={2}>{product.descriptionAr || 'لا يوجد وصف بعد.'}</AppText></View>
    <View style={[styles.cell, styles.actionColumn, styles.rowActions]}><Button label="تعديل" onPress={onEdit} /><Button label="معاينة" variant="secondary" onPress={onPreview} /></View>
  </View>;
}

function ProductPreview({ product, imageUrl, onClose, phone }: { product: OperationsProduct | null; imageUrl: string | null; onClose: () => void; phone: boolean }) {
  if (!product) return null;
  return <PreviewModal visible imageUrl={imageUrl} name={product.nameAr} price={product.price ? formatMoney(product.price) : 'السعر غير متوفر'} description={product.descriptionAr || 'لا تتوفر تفاصيل إضافية لهذا المنتج حالياً.'} availability={product.availability} onClose={onClose} phone={phone} />;
}

function DraftProductPreview({ product, values, imageUrl, onClose, phone }: { product: OperationsProduct | null; values: ProductForm | null; imageUrl: string | null; onClose: () => void; phone: boolean }) {
  if (!product || !values) return null;
  const price = values.sellingPrice === '' ? 'السعر غير متوفر' : sypText(Number(values.sellingPrice));
  return <PreviewModal visible imageUrl={imageUrl} name={values.nameAr} price={price} description={values.descriptionAr || 'لا تتوفر تفاصيل إضافية لهذا المنتج حالياً.'} availability={values.availability} onClose={onClose} draft phone={phone} />;
}

function PreviewModal({ visible, imageUrl, name, price, description, availability, onClose, draft = false, phone }: { visible: boolean; imageUrl: string | null; name: string; price: string; description: string; availability: Availability; onClose: () => void; draft?: boolean; phone: boolean }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={[styles.overlay, phone ? styles.overlayPhone : undefined]}><Surface style={phone ? [styles.previewModal, styles.previewModalPhone] : styles.previewModal} accessibilityViewIsModal><View style={styles.modalHeader}><View><AppText variant="h2">معاينة المنتج</AppText>{draft ? <AppText variant="caption" color={colors.warningText}>معاينة للتعديلات غير المحفوظة</AppText> : null}</View><Pressable accessibilityRole="button" accessibilityLabel="إغلاق المعاينة" onPress={onClose} style={styles.iconButton}><MaterialCommunityIcons name="close" size={24} color={colors.ink} /></Pressable></View><ScrollView contentContainerStyle={styles.doctorPreview}><Surface style={phone ? [styles.previewImage, styles.previewImagePhone] : styles.previewImage}>{imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="contain" style={[styles.previewImageContent, phone ? styles.previewImageContentPhone : undefined]} accessibilityLabel={`صورة ${name}`} /> : <MaterialCommunityIcons name="image-outline" size={64} color={colors.muted} />}</Surface><View style={styles.previewCopy}><View style={styles.previewAvailability}><MaterialCommunityIcons name={availability === 'available' ? 'check-circle-outline' : availability === 'limited' ? 'alert-circle-outline' : 'close-circle-outline'} size={18} color={availability === 'available' ? colors.successText : availability === 'limited' ? colors.warningText : colors.danger} /><AppText variant="small">{getAvailabilityLabel(availability)}</AppText></View><AppText variant={phone ? 'h2' : 'h1'}>{name}</AppText><AppText variant="h2">{price}</AppText><Button label="إضافة إلى السلة" disabled={availability === 'unavailable' || price === 'السعر غير متوفر'} onPress={() => undefined} /></View><Surface style={phone ? [styles.previewDescription, styles.previewDescriptionPhone] : styles.previewDescription}><AppText variant="h2">عن المنتج</AppText><AppText color={colors.muted}>{description}</AppText></Surface></ScrollView><Button label="إغلاق المعاينة" variant="secondary" onPress={onClose} /></Surface></View></Modal>;
}

function HeaderCell({ label, style }: { label: string; style?: object }) { return <View style={[styles.cell, style]}><AppText variant="caption" style={styles.semibold}>{label}</AppText></View>; }
function StockBadge({ label, icon, background, color }: ReturnType<typeof stockState>) { return <View style={[styles.stockBadge, { backgroundColor: background }]}><MaterialCommunityIcons name={icon} size={16} color={color} /><AppText variant="caption" color={color}>{label}</AppText></View>; }
function StockLegend({ color, label }: { color: string; label: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><AppText variant="caption" color={colors.muted}>{label}</AppText></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><AppText variant="caption" color={colors.muted}>{label}</AppText><AppText variant="small">{value}</AppText></View>; }

const styles = StyleSheet.create({
  page: { gap: spacing.md }, toolbar: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }, search: { flex: 1, minWidth: 240, maxWidth: 520 }, legend: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.sm }, legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs }, legendDot: { width: 8, height: 8, borderRadius: 4 },
  tableScroll: { flexGrow: 1 }, table: { width: '100%', gap: spacing.xs }, tableDesktop: { minWidth: 1000 }, headerRow: { flexDirection: 'row-reverse', minHeight: 44, alignItems: 'center', backgroundColor: colors.pale, borderRadius: radius.md, paddingHorizontal: spacing.sm }, dataRow: { flexDirection: 'row-reverse', minHeight: 92, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.sm }, cell: { width: 105, paddingHorizontal: spacing.xs, gap: spacing.xs }, productColumn: { width: 205 }, descriptionColumn: { width: 180 }, actionColumn: { width: 150 }, productCell: { flexDirection: 'row-reverse', alignItems: 'center' }, thumbnail: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.soft }, thumbnailPlaceholder: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }, productName: { flex: 1, minWidth: 0, gap: 2 },
  stockBadge: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: 4, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 }, rowActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs }, cardAction: { flexGrow: 1, minWidth: 120 }, mobileCard: { gap: spacing.md, padding: spacing.md }, mobileTitle: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }, mobileMetrics: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }, metric: { flexGrow: 1, flexBasis: 120, backgroundColor: colors.soft, borderRadius: radius.sm, padding: spacing.sm, gap: 2 }, loadMore: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  overlay: { flex: 1, backgroundColor: colors.overlay, padding: spacing.md, alignItems: 'center', justifyContent: 'center' }, overlayPhone: { padding: 0, justifyContent: 'flex-end' }, editorModal: { width: '100%', maxWidth: 1080, maxHeight: '94%', gap: spacing.md, padding: spacing.lg }, editorModalPhone: { maxHeight: '100%', height: '100%', borderRadius: 0, padding: spacing.md }, modalHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, iconButton: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }, editorContent: { paddingVertical: spacing.xs, paddingBottom: spacing.lg }, formGrid: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.lg }, formGridCompact: { flexDirection: 'column' }, formColumn: { flex: 1, width: '100%', gap: spacing.md }, imageColumn: { width: 380, maxWidth: '100%' }, twoColumns: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }, flexField: { flex: 1, minWidth: 180 }, profit: { backgroundColor: colors.successSurface, borderRadius: radius.sm, padding: spacing.sm }, profitLoss: { backgroundColor: '#F5E9E7' }, fieldGroup: { gap: spacing.xs }, availability: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs }, modalActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'flex-start', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md }, modalActionsPhone: { flexDirection: 'row-reverse' }, modalActionPhone: { flexGrow: 1, minWidth: 145 },
  previewModal: { width: '100%', maxWidth: 920, maxHeight: '94%', gap: spacing.md, padding: spacing.lg }, previewModalPhone: { maxHeight: '100%', height: '100%', borderRadius: 0, padding: spacing.md }, doctorPreview: { gap: spacing.lg, paddingBottom: spacing.md }, previewImage: { minHeight: 320, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale }, previewImagePhone: { minHeight: 240, padding: spacing.sm }, previewImageContent: { width: '100%', height: 320 }, previewImageContentPhone: { height: 240 }, previewCopy: { gap: spacing.md }, previewAvailability: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs }, previewDescription: { gap: spacing.md }, previewDescriptionPhone: { padding: spacing.md }, semibold: { fontFamily: typography.family.semibold, fontWeight: '600' },
});
