import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { colors, radius, spacing, typography } from '@tawreed/design-tokens';
import { formatMoney, getAvailabilityLabel, groupOperationsProducts, normalizeAppError, pickDisplayedOption, type Availability, type OperationsProduct, type OperationsProductGroup } from '@tawreed/domain';
import { AppText, Button, Field, Icon, StateView, Surface } from '@tawreed/ui';
import { useProductSearch } from '@/lib/use-product-search';
import { useData } from '@/providers/app-providers';
import { CategoryPicker, operationsErrorMessage, ProductGroupEditor, UnitPicker } from './product-group-editor';
import { ProductImageEditor, type ProductImageFile } from './product-image-editor';

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

type GroupFilter = 'all' | 'active' | 'archived' | 'options' | 'no-image' | 'no-price';
const groupFilters: { key: GroupFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'ظاهر للأطباء' },
  { key: 'archived', label: 'مؤرشف' },
  { key: 'options', label: 'بخيارات' },
  { key: 'no-image', label: 'بدون صورة' },
  { key: 'no-price', label: 'بدون سعر / حسب الطلب' },
];
const groupMatches = (group: OperationsProductGroup, filter: GroupFilter) => {
  const active = group.options.filter((option) => option.active);
  switch (filter) {
    case 'active': return active.length > 0;
    case 'archived': return !active.length;
    case 'options': return group.options.length > 1;
    case 'no-image': return active.some((option) => !option.media);
    case 'no-price': return active.some((option) => !option.price);
    default: return true;
  }
};

const moneyText = (value: OperationsProduct['price']) => value?.currency === 'USD' ? String(value.amountMinor / 100) : '';
const usdMinor = (value: string) => Math.round(Number(value) * 100);
const usdText = (value: number) => formatMoney({ amountMinor: Math.round(value * 100), currency: 'USD', decimalPlaces: 2 });
const convertedSypText = (usd: number, rate: number | null) => rate
  ? formatMoney({ amountMinor: Math.ceil((usd * rate) / 5) * 5, currency: 'NEW_SYP', decimalPlaces: 0 })
  : 'سعر الصرف غير متوفر';
const stockState = (product: Pick<OperationsProduct, 'onHand' | 'reserved' | 'lowStockThreshold'>) => {
  const available = product.onHand - product.reserved;
  if (available <= 0) return { label: 'نافد', icon: 'close-circle-outline' as const, background: colors.unavailableSurface, color: colors.danger };
  if (available <= product.lowStockThreshold) return { label: 'أوشك على النفاد', icon: 'alert-circle-outline' as const, background: colors.warningSurface, color: colors.warningText };
  return { label: 'متوفر', icon: 'check-circle-outline' as const, background: colors.successSurface, color: colors.successText };
};

export function ProductManagement({ products, loading, compact, phone, search, onSearch, onRefresh, onFeedback }: ProductManagementProps) {
  const data = useData();
  const exchangeRate = useQuery({
    queryKey: ['operations-exchange-rate'],
    queryFn: () => data!.operations.getActiveExchangeRate(),
    enabled: Boolean(data),
  });
  const usdToSypRate = exchangeRate.data?.baseCurrency === 'USD' && exchangeRate.data.quoteCurrency === 'NEW_SYP'
    ? exchangeRate.data.rate
    : null;
  const [editing, setEditing] = useState<OperationsProduct | null>(null);
  const [archiving, setArchiving] = useState<OperationsProductGroup | null>(null);
  const [previewing, setPreviewing] = useState<OperationsProductGroup | null>(null);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({ nameAr: '', unitLabelAr: 'قطعة', categoryId: '' });
  const categories = useQuery({ queryKey: ['operations-categories'], queryFn: () => data!.catalog.listCategories(), enabled: Boolean(data) });
  const [draftPreview, setDraftPreview] = useState<ProductForm | null>(null);
  const [image, setImage] = useState<ProductImageFile | null>(null);
  const [visibleCount, setVisibleCount] = useState(40);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { nameAr: '', manufacturer: '', unitLabelAr: 'قطعة', packageLabelAr: '', sellingPrice: '', cost: '', onHand: '0', lowStockThreshold: '5', descriptionAr: '', specificationsAr: '', inventoryNotes: '', availability: 'unavailable' },
  });
  const watchedSelling = useWatch({ control: form.control, name: 'sellingPrice' });
  const watchedCost = useWatch({ control: form.control, name: 'cost' });
  const profit = watchedSelling !== '' && watchedCost !== '' ? Number(watchedSelling) - Number(watchedCost) : null;
  const groups = useMemo(() => groupOperationsProducts(products), [products]);
  const productSearch = useProductSearch(search);
  const filteredGroups = useMemo(() => {
    const matching = groups.filter((group) => groupMatches(group, filter) && (!categoryFilter || group.options.some((option) => option.category?.id === categoryFilter)) && group.options.some(productSearch.matches));
    if (!productSearch.active) return matching;
    // Best match first; groups with equal relevance keep their usual order.
    const groupRank = (group: OperationsProductGroup) => Math.max(...group.options.map(productSearch.rankOf));
    return matching.map((group, index) => ({ group, index, rank: groupRank(group) })).sort((a, b) => b.rank - a.rank || a.index - b.index).map(({ group }) => group);
  }, [categoryFilter, filter, groups, productSearch]);
  const visibleGroups = filteredGroups.slice(0, visibleCount);
  const openGroup = groups.find((group) => group.key === openGroupKey) ?? null;
  const create = useMutation({
    mutationFn: () => data!.operations.createProduct(newProduct),
    onSuccess: async (id) => {
      await onRefresh();
      setCreating(false);
      setNewProduct({ nameAr: '', unitLabelAr: 'قطعة', categoryId: '' });
      setOpenGroupKey(id);
      onFeedback('تم إنشاء المنتج. أضف سعره وصورته وخياراته ليظهر للأطباء.');
    },
    onError: (error) => onFeedback(operationsErrorMessage(error), true),
  });
  const archive = useMutation({
    mutationFn: async (group: OperationsProductGroup) => data!.operations.archiveProducts(group.options.filter((option) => option.active).map((option) => option.id)),
    onSuccess: async () => {
      await onRefresh();
      setArchiving(null);
      onFeedback('تم حذف المنتج من العرض ونقله إلى المؤرشفات.');
    },
    onError: (error) => onFeedback(operationsErrorMessage(error), true),
  });

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
    setAdvancedOpen(false);
    setEditing(product);
  };
  const closeEditor = () => {
    if (image?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    setDraftPreview(null);
    setAdvancedOpen(false);
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
        sellingPriceMinor: values.sellingPrice === '' ? null : usdMinor(values.sellingPrice),
        costMinor: values.cost === '' ? null : usdMinor(values.cost),
        currency: 'USD',
        decimalPlaces: 2,
        onHand,
        inventoryNotes: values.inventoryNotes,
        image: image ? { bytes: image.bytes, mimeType: image.mimeType, extension: image.extension, width: image.width, height: image.height } : undefined,
      });
    },
    onSuccess: async () => {
      await onRefresh();
      closeEditor();
      onFeedback('تم حفظ معلومات الخيار بنجاح.');
    },
    onError: (error) => onFeedback(error instanceof Error && error.message.startsWith('لا يمكن') ? error.message : normalizeAppError(error).messageAr, true),
  });

  const showDraftPreview = form.handleSubmit((values) => setDraftPreview(values));
  const currentImage = editing && data ? data.media.resolve(editing.media) : null;

  if (loading) return <StateView loading title="جاري تحميل المنتجات" message="لحظات قليلة." />;
  return <View style={styles.page}>
    <View style={styles.toolbar}>
      <View style={styles.search}><Field label="بحث بالاسم أو SKU أو الخيار" placeholder="يتحمّل الأخطاء الإملائية والمرادفات" value={search} onChangeText={(value) => { setVisibleCount(40); onSearch(value); }} /></View>
      <Button label="+ منتج جديد" onPress={() => setCreating(true)} />
      <View style={styles.legend}>
        <StockLegend color={colors.successText} label="متوفر" />
        <StockLegend color={colors.warningText} label="قرب النفاد" />
        <StockLegend color={colors.danger} label="نافد" />
      </View>
    </View>
    <View style={styles.filters}>{groupFilters.map((item) => <Pressable key={item.key} accessibilityRole="radio" accessibilityState={{ selected: filter === item.key }} onPress={() => { setVisibleCount(40); setFilter(item.key); }} style={[styles.filterChip, filter === item.key && styles.filterChipSelected]}><AppText variant="small" color={filter === item.key ? colors.white : colors.ink}>{item.label} ({groups.filter((group) => groupMatches(group, item.key)).length.toLocaleString('ar-SY')})</AppText></Pressable>)}</View>
    {categories.data?.length ? <View style={styles.filters} accessibilityLabel="تصفية حسب الفئة">{[{ id: null, nameAr: 'كل الفئات' }, ...categories.data].map((category) => { const selected = categoryFilter === category.id; const count = category.id ? groups.filter((group) => group.options.some((option) => option.category?.id === category.id)).length : groups.length; return <Pressable key={category.id ?? 'all'} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { setVisibleCount(40); setCategoryFilter(category.id); }} style={[styles.filterChip, styles.categoryChip, selected && styles.categoryChipSelected]}><AppText variant="small" color={selected ? colors.white : colors.ink}>{category.nameAr} ({count.toLocaleString('ar-SY')})</AppText></Pressable>; })}</View> : null}
    <ScrollView horizontal={!compact} contentContainerStyle={styles.tableScroll}>
      <View style={[styles.table, !compact && styles.tableDesktop]}>
        {!compact ? <View style={styles.headerRow}>
          <HeaderCell label="المنتج" style={styles.productColumn} />
          <HeaderCell label="الخيارات" style={styles.descriptionColumn} />
          <HeaderCell label="سعر البيع" />
          <HeaderCell label="أقل ربح/قطعة" />
          <HeaderCell label="المخزون" />
          <HeaderCell label="الحالة" />
          <HeaderCell label="الإجراءات" style={styles.actionColumn} />
        </View> : null}
        {visibleGroups.map((group) => <ProductGroupRow key={group.key} group={group} compact={compact} imageUrl={data?.media.resolve(pickDisplayedOption(group.options)?.media ?? null) ?? null} onManage={() => setOpenGroupKey(group.key)} onEdit={() => openEditor(group.options.find((option) => option.active) ?? group.options[0])} onPreview={() => setPreviewing(group)} onArchive={() => setArchiving(group)} />)}
        {!filteredGroups.length ? <StateView title="لا توجد نتائج" message="جرّب تغيير عبارة البحث." /> : null}
      </View>
    </ScrollView>
    {visibleCount < filteredGroups.length ? <View style={styles.loadMore}><AppText variant="small" color={colors.muted}>يظهر {visibleGroups.length.toLocaleString('ar-SY')} من {filteredGroups.length.toLocaleString('ar-SY')} منتج</AppText><Button label="عرض المزيد" variant="secondary" onPress={() => setVisibleCount((count) => count + 40)} /></View> : null}

    <ProductGroupEditor key={openGroup?.key ?? 'closed'} group={openGroup} categories={categories.data ?? []} phone={phone} compact={compact} onClose={() => setOpenGroupKey(null)} onEditOption={openEditor} onPreview={setPreviewing} onRefresh={onRefresh} onFeedback={onFeedback} />

    <Modal visible={Boolean(archiving)} transparent animationType="fade" onRequestClose={() => { if (!archive.isPending) setArchiving(null); }}>
      <View style={[styles.overlay, phone && styles.overlayPhone]}>
        <Surface style={styles.confirmModal} accessibilityViewIsModal>
          <View style={styles.modalHeader}><AppText variant="h2">حذف المنتج؟</AppText><Pressable accessibilityRole="button" accessibilityLabel="إغلاق التأكيد" disabled={archive.isPending} onPress={() => setArchiving(null)} style={styles.iconButton}><Icon name="close" size={24} color={colors.ink} /></Pressable></View>
          <AppText color={colors.muted}>سيختفي «{archiving?.options[0]?.nameAr}» من تطبيق الأطباء وينتقل إلى المؤرشفات، ويمكن استعادته لاحقاً. لن تُحذف صوره أو بياناته.</AppText>
          <View style={styles.confirmActions}><Button label="إلغاء" variant="secondary" disabled={archive.isPending} onPress={() => setArchiving(null)} style={styles.confirmAction} /><Button label="حذف ونقل للمؤرشفات" variant="danger" loading={archive.isPending} onPress={() => { if (archiving) archive.mutate(archiving); }} style={styles.confirmAction} /></View>
        </Surface>
      </View>
    </Modal>

    <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
      <View style={[styles.overlay, phone && styles.overlayPhone]}>
        <Surface style={phone ? [styles.previewModal, styles.previewModalPhone] : styles.createModal} accessibilityViewIsModal>
          <View style={styles.modalHeader}><AppText variant="h2">منتج جديد</AppText><Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={() => setCreating(false)} style={styles.iconButton}><Icon name="close" size={24} color={colors.ink} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled">
            <Field label="اسم المنتج" value={newProduct.nameAr} onChangeText={(nameAr) => setNewProduct((current) => ({ ...current, nameAr }))} />
            <UnitPicker value={newProduct.unitLabelAr} onChange={(unitLabelAr) => setNewProduct((current) => ({ ...current, unitLabelAr }))} />
            <CategoryPicker categories={categories.data ?? []} value={newProduct.categoryId} onChange={(categoryId) => setNewProduct((current) => ({ ...current, categoryId }))} />
            <AppText variant="caption" color={colors.muted}>يُنشأ المنتج بدون سعر ومخفياً عن الأطباء، ثم تضيف سعره وصوره وخياراته من شاشة إدارة المنتج.</AppText>
          </ScrollView>
          <Button label="إنشاء المنتج" loading={create.isPending} disabled={newProduct.nameAr.trim().length < 2 || !newProduct.unitLabelAr.trim() || !newProduct.categoryId} onPress={() => create.mutate()} />
        </Surface>
      </View>
    </Modal>

    {/* Mounted on demand so it stacks above the group editor modal. */}
    {editing ? <Modal visible transparent animationType="fade" onRequestClose={closeEditor}>
      <View style={[styles.overlay, phone && styles.overlayPhone]}>
        <Surface style={phone ? [styles.editorModal, styles.editorModalPhone] : styles.editorModal} accessibilityViewIsModal>
          <View style={styles.modalHeader}>
            <View style={styles.productName}><AppText variant="h2">{editing?.variantLabelAr ? `تعديل الخيار: ${editing.variantLabelAr}` : 'تعديل المنتج'}</AppText><AppText variant="small" color={colors.muted}>{editing?.sku}{editing?.variantLabelAr ? ' · الاسم والوصف المشتركان يُعدّلان من إدارة المنتج' : ''}</AppText></View>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق التعديل" onPress={closeEditor} style={styles.iconButton}><Icon name="close" size={24} color={colors.ink} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.formGrid, compact && styles.formGridCompact]}>
              <View style={styles.formColumn}>
                <Controller control={form.control} name="nameAr" render={({ field, fieldState }) => <Field label="اسم المنتج" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                <View style={styles.twoColumns}>
                  <View style={styles.flexField}><Controller control={form.control} name="sellingPrice" render={({ field, fieldState }) => <Field label="سعر البيع (USD)" keyboardType="decimal-pad" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                  <View style={styles.flexField}><Controller control={form.control} name="cost" render={({ field, fieldState }) => <Field label="سعر التكلفة (USD)" keyboardType="decimal-pad" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                </View>
                <View style={[styles.profit, profit !== null && profit < 0 && styles.profitLoss]}><AppText variant="small" color={profit !== null && profit < 0 ? colors.danger : colors.successText}>الربح لكل قطعة: {profit === null ? 'أدخل السعر والتكلفة' : usdText(profit)}</AppText><AppText variant="caption" color={colors.muted}>يُحوّل سعر البيع للموقع حسب سعر الصرف ويُقرّب للأعلى لأقرب 5 ليرات.</AppText></View>
                <View style={styles.twoColumns}>
                  <View style={styles.flexField}><Controller control={form.control} name="onHand" render={({ field, fieldState }) => <Field label="الكمية الموجودة" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                  <View style={styles.flexField}><Controller control={form.control} name="lowStockThreshold" render={({ field, fieldState }) => <Field label="حد التنبيه" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                </View>
                {editing ? <AppText variant="caption" color={colors.muted}>المحجوز حالياً: {editing.reserved.toLocaleString('ar-SY')} — لا يمكن خفض الموجود عن المحجوز.</AppText> : null}
                <Controller control={form.control} name="availability" render={({ field }) => <View style={styles.fieldGroup}><AppText variant="small">حالة العرض</AppText><View style={styles.availability}>{(['available', 'limited', 'unavailable'] as const).map((item) => <Button key={item} label={getAvailabilityLabel(item)} variant={field.value === item ? 'primary' : 'secondary'} onPress={() => field.onChange(item)} />)}</View></View>} />

                <Pressable accessibilityRole="button" accessibilityState={{ expanded: advancedOpen }} onPress={() => setAdvancedOpen((current) => !current)} style={styles.advancedToggle}>
                  <Icon name={advancedOpen ? 'chevron-left' : 'chevron-left'} size={18} color={colors.muted} style={advancedOpen ? styles.advancedChevronOpen : undefined} />
                  <AppText variant="small" style={styles.semibold}>إعدادات متقدمة</AppText>
                </Pressable>
                {advancedOpen ? <View style={styles.advancedSection}>
                  <Controller control={form.control} name="manufacturer" render={({ field, fieldState }) => <Field label="الشركة المصنعة" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                  <View style={styles.twoColumns}>
                    <View style={styles.flexField}><Controller control={form.control} name="unitLabelAr" render={({ field, fieldState }) => <UnitPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} />} /></View>
                    <View style={styles.flexField}><Controller control={form.control} name="packageLabelAr" render={({ field, fieldState }) => <Field label="النوع أو العبوة" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} /></View>
                  </View>
                  <Controller control={form.control} name="descriptionAr" render={({ field, fieldState }) => <Field label="الوصف الظاهر في تطبيق الدكتور" multiline numberOfLines={5} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                  <Controller control={form.control} name="specificationsAr" render={({ field, fieldState }) => <Field label="المواصفات والخيارات" multiline numberOfLines={4} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                  <Controller control={form.control} name="inventoryNotes" render={({ field, fieldState }) => <Field label="سبب تعديل المخزون (عند تغيير الكمية)" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />} />
                </View> : null}
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
    </Modal> : null}

    <GroupPreview group={previewing} resolve={(asset) => data?.media.resolve(asset) ?? null} exchangeRate={usdToSypRate} onClose={() => setPreviewing(null)} phone={phone} />
    <DraftProductPreview product={editing} values={draftPreview} imageUrl={image?.previewUrl ?? currentImage} exchangeRate={usdToSypRate} onClose={() => setDraftPreview(null)} phone={phone} />
  </View>;
}

function ProductGroupRow({ group, compact, imageUrl, onManage, onEdit, onPreview, onArchive }: { group: OperationsProductGroup; compact: boolean; imageUrl: string | null; onManage: () => void; onEdit: () => void; onPreview: () => void; onArchive: () => void }) {
  const grouped = Boolean(group.variantGroupKey);
  const lead = group.options.find((option) => option.active) ?? group.options[0];
  const active = group.options.filter((option) => option.active);
  const prices = active.flatMap((option) => option.price ? [option.price] : []).sort((left, right) => left.amountMinor - right.amountMinor);
  const hasRequestPrice = active.some((option) => option.priceOnRequest);
  const priceText = !prices.length ? hasRequestPrice ? 'حسب الطلب' : '—' : prices[0].amountMinor === prices[prices.length - 1].amountMinor ? formatMoney(prices[0]) : `${formatMoney(prices[0])} – ${formatMoney(prices[prices.length - 1])}`;
  const profits = active.flatMap((option) => option.price && option.cost ? [option.price.amountMinor - option.cost.amountMinor] : []);
  const profitText = !profits.length || !prices.length ? '—' : formatMoney({ amountMinor: Math.min(...profits), currency: prices[0].currency, decimalPlaces: prices[0].decimalPlaces });
  const stock = stockState({ onHand: active.reduce((sum, option) => sum + option.onHand, 0), reserved: active.reduce((sum, option) => sum + option.reserved, 0), lowStockThreshold: lead.lowStockThreshold });
  const missing = [!active.length ? 'مؤرشف' : null, active.some((option) => !option.price && !option.priceOnRequest) ? 'خيار بدون سعر' : null, active.some((option) => !option.media) ? 'خيار بدون صورة' : null].filter(Boolean).join(' · ');
  const status = missing || (hasRequestPrice ? 'حسب الطلب' : 'جاهز');
  const optionsText = group.variantGroupKey ? group.options.map((option) => option.variantLabelAr ?? option.sku).join('، ') : 'بدون خيارات';
  const title = <View style={styles.productName}><AppText variant={compact ? 'body' : 'small'} style={styles.semibold} numberOfLines={2}>{lead.nameAr}</AppText><AppText variant="caption" color={colors.muted}>{lead.category?.nameAr ?? 'بدون فئة'} · {lead.unitLabelAr} · {group.options.length > 1 ? `${group.options.length.toLocaleString('ar-SY')} خيارات` : lead.sku}</AppText></View>;
  const thumbnail = imageUrl ? <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="contain" /> : <View style={styles.thumbnailPlaceholder}><Icon name="image-outline" size={24} color={colors.muted} /></View>;
  if (compact) return <Surface style={styles.mobileCard}>
    <View style={styles.mobileTitle}>{thumbnail}{title}<StockBadge {...stock} /></View>
    <AppText variant="small" color={colors.muted} numberOfLines={2}>{optionsText}</AppText>
    <View style={styles.mobileMetrics}><Metric label="البيع" value={priceText} /><Metric label="أقل ربح" value={profitText} /></View>
    {missing ? <AppText variant="caption" color={colors.warningText}>{missing}</AppText> : null}
    <View style={styles.rowActions}>{grouped ? <Button label="إدارة" onPress={onManage} style={styles.cardAction} /> : <Button label="تعديل" onPress={onEdit} style={styles.cardAction} />}<Button label="معاينة" variant="secondary" onPress={onPreview} style={styles.cardAction} />{active.length ? <Button label="حذف" variant="danger" onPress={onArchive} style={styles.cardAction} /> : null}</View>
  </Surface>;
  return <View style={[styles.dataRow, !active.length && styles.dataRowArchived]}>
    <View style={[styles.cell, styles.productColumn, styles.productCell]}>{thumbnail}{title}</View>
    <View style={[styles.cell, styles.descriptionColumn]}><AppText variant="small" color={colors.muted} numberOfLines={2}>{optionsText}</AppText></View>
    <View style={styles.cell}><AppText variant="small">{priceText}</AppText></View>
    <View style={styles.cell}><AppText variant="small" color={profits.some((profit) => profit < 0) ? colors.danger : colors.successText}>{profitText}</AppText></View>
    <View style={styles.cell}><StockBadge {...stock} /></View>
    <View style={styles.cell}><AppText variant="caption" color={missing || hasRequestPrice ? colors.warningText : colors.successText}>{status}</AppText></View>
    <View style={[styles.cell, styles.actionColumn, styles.rowActions]}>{grouped ? <Button label="إدارة" onPress={onManage} style={styles.tableAction} /> : <Button label="تعديل" onPress={onEdit} style={styles.tableAction} />}<Button label="معاينة" variant="secondary" onPress={onPreview} style={styles.tableAction} />{active.length ? <Button label="حذف" variant="danger" onPress={onArchive} style={styles.tableAction} /> : null}</View>
  </View>;
}

function GroupPreview({ group, resolve, exchangeRate, onClose, phone }: { group: OperationsProductGroup | null; resolve: (asset: OperationsProduct['media']) => string | null; exchangeRate: number | null; onClose: () => void; phone: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!group) return null;
  // Mirrors the Doctor app: active options with a fixed price or "حسب الطلب" are offered.
  const offered = group.options.filter((option) => option.active && (option.price || option.priceOnRequest));
  const options = group.variantGroupKey ? offered : [];
  const selected = options.find((option) => option.id === selectedId) ?? pickDisplayedOption(group.options) ?? group.options[0];
  const sypText = (option: OperationsProduct) => option.price?.currency === 'USD' ? convertedSypText(option.price.amountMinor / 100, exchangeRate) : option.price ? formatMoney(option.price) : option.priceOnRequest ? 'حسب الطلب' : 'السعر غير متوفر';
  const close = () => { setSelectedId(null); onClose(); };
  return <PreviewModal visible imageUrl={resolve(selected.media)} name={selected.nameAr} price={sypText(selected)} description={selected.descriptionAr || 'لا تتوفر تفاصيل إضافية لهذا المنتج حالياً.'} availability={selected.availability} onClose={close} phone={phone}
    hidden={!offered.length}
    options={options.map((option) => ({ id: option.id, label: option.variantLabelAr ?? option.sku, price: sypText(option) }))}
    selectedOptionId={selected.id} onSelectOption={setSelectedId} />;
}

function DraftProductPreview({ product, values, imageUrl, exchangeRate, onClose, phone }: { product: OperationsProduct | null; values: ProductForm | null; imageUrl: string | null; exchangeRate: number | null; onClose: () => void; phone: boolean }) {
  if (!product || !values) return null;
  const price = values.sellingPrice === '' ? 'السعر غير متوفر' : convertedSypText(Number(values.sellingPrice), exchangeRate);
  return <PreviewModal visible imageUrl={imageUrl} name={values.nameAr} price={price} description={values.descriptionAr || 'لا تتوفر تفاصيل إضافية لهذا المنتج حالياً.'} availability={values.availability} onClose={onClose} draft phone={phone} />;
}

function PreviewModal({ visible, imageUrl, name, price, description, availability, onClose, draft = false, phone, hidden = false, options = [], selectedOptionId, onSelectOption }: { visible: boolean; imageUrl: string | null; name: string; price: string; description: string; availability: Availability; onClose: () => void; draft?: boolean; phone: boolean; hidden?: boolean; options?: { id: string; label: string; price: string }[]; selectedOptionId?: string; onSelectOption?: (id: string) => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={[styles.overlay, phone ? styles.overlayPhone : undefined]}><Surface style={phone ? [styles.previewModal, styles.previewModalPhone] : styles.previewModal} accessibilityViewIsModal><View style={styles.modalHeader}><View><AppText variant="h2">معاينة المنتج</AppText>{draft ? <AppText variant="caption" color={colors.warningText}>معاينة للتعديلات غير المحفوظة</AppText> : null}{hidden ? <AppText variant="caption" color={colors.danger}>هذا المنتج غير ظاهر للأطباء حالياً (مؤرشف أو بدون سعر)</AppText> : null}</View><Pressable accessibilityRole="button" accessibilityLabel="إغلاق المعاينة" onPress={onClose} style={styles.iconButton}><Icon name="close" size={24} color={colors.ink} /></Pressable></View><ScrollView contentContainerStyle={styles.doctorPreview}><Surface style={phone ? [styles.previewImage, styles.previewImagePhone] : styles.previewImage}>{imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="contain" style={[styles.previewImageContent, phone ? styles.previewImageContentPhone : undefined]} accessibilityLabel={`صورة ${name}`} /> : <Icon name="image-outline" size={64} color={colors.muted} />}</Surface><View style={styles.previewCopy}><View style={styles.previewAvailability}><Icon name={availability === 'available' ? 'check-circle-outline' : availability === 'limited' ? 'alert-circle-outline' : 'close-circle-outline'} size={18} color={availability === 'available' ? colors.successText : availability === 'limited' ? colors.warningText : colors.danger} /><AppText variant="small">{getAvailabilityLabel(availability)}</AppText></View><AppText variant={phone ? 'h2' : 'h1'}>{name}</AppText>{options.length ? <View style={styles.previewOptions}><AppText variant="small">اختر النوع أو العبوة</AppText><View style={styles.filters}>{options.map((option) => { const selected = option.id === selectedOptionId; return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onSelectOption?.(option.id)} style={[styles.previewOption, selected && styles.filterChipSelected]}><AppText variant="small" color={selected ? colors.white : colors.ink}>{option.label}</AppText><AppText variant="caption" color={selected ? colors.white : colors.muted}>{option.price}</AppText></Pressable>; })}</View></View> : null}<AppText variant="h2">{price}</AppText><Button label={price === 'حسب الطلب' ? 'حسب الطلب' : 'إضافة إلى السلة'} disabled={availability === 'unavailable' || price === 'السعر غير متوفر'} onPress={() => undefined} /></View><Surface style={phone ? [styles.previewDescription, styles.previewDescriptionPhone] : styles.previewDescription}><AppText variant="h2">عن المنتج</AppText><AppText color={colors.muted}>{description}</AppText></Surface></ScrollView><Button label="إغلاق المعاينة" variant="secondary" onPress={onClose} /></Surface></View></Modal>;
}

function HeaderCell({ label, style }: { label: string; style?: object }) { return <View style={[styles.cell, style]}><AppText variant="caption" style={styles.semibold}>{label}</AppText></View>; }
function StockBadge({ label, icon, background, color }: ReturnType<typeof stockState>) { return <View style={[styles.stockBadge, { backgroundColor: background }]}><Icon name={icon} size={16} color={color} /><AppText variant="caption" color={color}>{label}</AppText></View>; }
function StockLegend({ color, label }: { color: string; label: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><AppText variant="caption" color={colors.muted}>{label}</AppText></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><AppText variant="caption" color={colors.muted}>{label}</AppText><AppText variant="small">{value}</AppText></View>; }

const styles = StyleSheet.create({
  page: { gap: spacing.md }, toolbar: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }, search: { flex: 1, minWidth: 240, maxWidth: 520 }, legend: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.sm }, legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs }, legendDot: { width: 8, height: 8, borderRadius: 4 },
  filters: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs }, filterChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, filterChipSelected: { backgroundColor: colors.deep, borderColor: colors.deep }, categoryChip: { minHeight: 36, backgroundColor: colors.pale }, categoryChipSelected: { backgroundColor: colors.successText, borderColor: colors.successText },
  previewOptions: { gap: spacing.xs }, previewOption: { minWidth: 110, minHeight: 48, justifyContent: 'center', gap: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.white },
  createModal: { width: '100%', maxWidth: 640, maxHeight: '94%', gap: spacing.md, padding: spacing.lg }, createContent: { gap: spacing.md }, dataRowArchived: { opacity: 0.6 },
  tableScroll: { flexGrow: 1 }, table: { width: '100%', gap: spacing.xs }, tableDesktop: { minWidth: 1120 }, headerRow: { flexDirection: 'row-reverse', minHeight: 44, alignItems: 'center', backgroundColor: colors.pale, borderRadius: radius.md, paddingHorizontal: spacing.sm }, dataRow: { flexDirection: 'row-reverse', minHeight: 92, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.sm }, cell: { width: 105, paddingHorizontal: spacing.xs, gap: spacing.xs }, productColumn: { width: 205 }, descriptionColumn: { width: 180 }, actionColumn: { width: 270 }, productCell: { flexDirection: 'row-reverse', alignItems: 'center' }, thumbnail: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.soft }, thumbnailPlaceholder: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }, productName: { flex: 1, minWidth: 0, gap: 2 },
  stockBadge: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: 4, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 }, rowActions: { flexDirection: 'row-reverse', flexWrap: 'nowrap', gap: spacing.sm }, cardAction: { flex: 1, minWidth: 0 }, tableAction: { flex: 1, minWidth: 0 }, mobileCard: { gap: spacing.md, padding: spacing.md }, mobileTitle: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }, mobileMetrics: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm }, metric: { flexGrow: 1, flexBasis: 120, backgroundColor: colors.soft, borderRadius: radius.sm, padding: spacing.sm, gap: 2 }, loadMore: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  overlay: { flex: 1, backgroundColor: colors.overlay, padding: spacing.md, alignItems: 'center', justifyContent: 'center' }, overlayPhone: { padding: 0, justifyContent: 'flex-end' }, editorModal: { width: '100%', maxWidth: 1080, maxHeight: '94%', gap: spacing.md, padding: spacing.lg }, editorModalPhone: { maxHeight: '100%', height: '100%', borderRadius: 0, padding: spacing.md }, modalHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, iconButton: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }, editorContent: { paddingVertical: spacing.xs, paddingBottom: spacing.lg }, formGrid: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.lg }, formGridCompact: { flexDirection: 'column' }, formColumn: { flex: 1, width: '100%', gap: spacing.md }, imageColumn: { width: 380, maxWidth: '100%' }, twoColumns: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  advancedToggle: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' }, advancedChevronOpen: { transform: [{ rotate: '-90deg' }] }, advancedSection: { gap: spacing.md, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line }, flexField: { flex: 1, minWidth: 180 }, profit: { backgroundColor: colors.successSurface, borderRadius: radius.sm, padding: spacing.sm }, profitLoss: { backgroundColor: '#F5E9E7' }, fieldGroup: { gap: spacing.xs }, availability: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs }, modalActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'flex-start', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md }, modalActionsPhone: { flexDirection: 'row-reverse' }, modalActionPhone: { flexGrow: 1, minWidth: 145 },
  previewModal: { width: '100%', maxWidth: 920, maxHeight: '94%', gap: spacing.md, padding: spacing.lg }, previewModalPhone: { maxHeight: '100%', height: '100%', borderRadius: 0, padding: spacing.md }, doctorPreview: { gap: spacing.lg, paddingBottom: spacing.md }, previewImage: { minHeight: 320, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pale }, previewImagePhone: { minHeight: 240, padding: spacing.sm }, previewImageContent: { width: '100%', height: 320 }, previewImageContentPhone: { height: 240 }, previewCopy: { gap: spacing.md }, previewAvailability: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs }, previewDescription: { gap: spacing.md }, previewDescriptionPhone: { padding: spacing.md }, semibold: { fontFamily: typography.family.semibold, fontWeight: '600' },
  confirmModal: { width: '100%', maxWidth: 520, gap: spacing.lg, padding: spacing.lg }, confirmActions: { flexDirection: 'row-reverse', gap: spacing.sm }, confirmAction: { flex: 1 },
});
