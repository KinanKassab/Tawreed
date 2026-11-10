import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import type { BundleItem, OperationsProduct, OperationsPromoBanner } from '@tawreed/domain';
import { AppText, Button, Field, Icon, QuantityInput, StateView, Surface } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { operationsErrorMessage } from './product-group-editor';
import { ProductImageEditor, type ProductImageFile } from './product-image-editor';

interface BannerManagementProps {
  phone: boolean;
  onFeedback: (message: string, error?: boolean) => void;
}

const toDateInput = (iso: string | null) => iso ? iso.slice(0, 10) : '';
const fromDateInput = (value: string) => value.trim() ? new Date(`${value.trim()}T23:59:59`).toISOString() : null;

interface OfferDraft { price: string; items: BundleItem[] }
const emptyOffer: OfferDraft = { price: '', items: [] };
const offerDraftOf = (banner: OperationsPromoBanner): OfferDraft => ({
  price: banner.bundlePriceUsd ? String(banner.bundlePriceUsd.amountMinor / 100) : '',
  items: banner.bundleItems ?? [],
});
/** null = no offer; undefined = incomplete, so saving stays blocked. */
const offerInput = ({ price, items }: OfferDraft) => {
  if (!price.trim() && !items.length) return null;
  const priceUsdMinor = Math.round(Number(price) * 100);
  return items.length && Number.isFinite(priceUsdMinor) && priceUsdMinor > 0 ? { items, priceUsdMinor } : undefined;
};

function OfferFields({ value, onChange }: { value: OfferDraft; onChange: (value: OfferDraft) => void }) {
  const data = useData();
  const products = useQuery({ queryKey: ['operations-offer-products'], queryFn: () => data!.operations.listProducts(), enabled: Boolean(data) });
  const [search, setSearch] = useState('');
  const sellable = (products.data ?? []).filter((product) => product.active && product.price);
  const labelOf = (product: OperationsProduct) => [product.nameAr, product.variantLabelAr].filter(Boolean).join(' - ');
  const term = search.trim();
  const results = term ? sellable.filter((product) => labelOf(product).includes(term) && !value.items.some((item) => item.productId === product.id)).slice(0, 6) : [];
  const setItems = (items: BundleItem[]) => onChange({ ...value, items });
  const incomplete = offerInput(value) === undefined;

  return <View style={styles.offer}>
    <AppText variant="small" style={styles.semibold}>عرض مجمّع (اختياري)</AppText>
    <AppText variant="caption" color={colors.muted}>عند الضغط على البانر يشتري الطبيب هذه المنتجات معاً بالسعر الثابت الذي تحدده.</AppText>
    <Field label="سعر العرض بالدولار" keyboardType="decimal-pad" placeholder="50" value={value.price} onChangeText={(price) => onChange({ ...value, price })} />
    <Field label="ابحث عن منتج لإضافته" value={search} onChangeText={setSearch} />
    {results.map((product) => <Pressable key={product.id} accessibilityRole="button" onPress={() => { setItems([...value.items, { productId: product.id, quantity: 1 }]); setSearch(''); }} style={styles.result}><AppText variant="small">{labelOf(product)}</AppText></Pressable>)}
    {value.items.map((item) => {
      const product = sellable.find((candidate) => candidate.id === item.productId);
      return <View key={item.productId} style={styles.offerItem}>
        <AppText variant="small" style={styles.flex}>{product ? labelOf(product) : 'منتج غير متاح'}</AppText>
        <QuantityInput value={item.quantity} onChange={(quantity) => setItems(value.items.map((candidate) => candidate.productId === item.productId ? { ...candidate, quantity } : candidate))} />
        <Button label="حذف" variant="secondary" onPress={() => setItems(value.items.filter((candidate) => candidate.productId !== item.productId))} />
      </View>;
    })}
    {incomplete ? <AppText variant="caption" color={colors.danger}>لإضافة عرض حدد سعراً بالدولار ومنتجاً واحداً على الأقل.</AppText> : null}
  </View>;
}

export function BannerManagement({ phone, onFeedback }: BannerManagementProps) {
  const data = useData();
  const queryClient = useQueryClient();
  const banners = useQuery({ queryKey: ['operations-banners'], queryFn: () => data!.operations.listBanners(), enabled: Boolean(data) });
  const [newTitle, setNewTitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newImage, setNewImage] = useState<ProductImageFile | null>(null);
  const [newOffer, setNewOffer] = useState<OfferDraft>(emptyOffer);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['operations-banners'] });

  const create = useMutation({
    mutationFn: async () => {
      if (!data || !newImage) return;
      await data.operations.createBanner({ titleAr: newTitle.trim(), linkUrl: newLink.trim() || null, image: newImage, offer: offerInput(newOffer) ?? null });
    },
    onSuccess: async () => {
      await refresh();
      setNewTitle('');
      setNewLink('');
      setNewImage(null);
      setNewOffer(emptyOffer);
      onFeedback('تمت إضافة البانر.');
    },
    onError: (error) => onFeedback(operationsErrorMessage(error), true),
  });

  const move = useMutation({
    mutationFn: async (ids: string[]) => { if (data) await data.operations.reorderBanners(ids); },
    onSuccess: refresh,
    onError: (error) => onFeedback(operationsErrorMessage(error), true),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { if (data) await data.operations.deleteBanner(id); },
    onSuccess: async () => { await refresh(); onFeedback('تم حذف البانر.'); },
    onError: (error) => onFeedback(operationsErrorMessage(error), true),
  });

  const reorder = (index: number, direction: -1 | 1) => {
    const ordered = [...(banners.data ?? [])].sort((left, right) => left.sortOrder - right.sortOrder).map((banner) => banner.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    move.mutate(ordered);
  };

  if (banners.isLoading) return <StateView loading title="جاري تحميل البانرات" message="لحظات قليلة." />;
  const sorted = [...(banners.data ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);

  return <View style={styles.page}>
    <AppText color={colors.muted}>تظهر البانرات النشطة وغير المنتهية على واجهة المتجر، بالترتيب أدناه.</AppText>
    {sorted.map((banner, index) => <BannerRow
      key={banner.id}
      banner={banner}
      phone={phone}
      canMoveUp={index > 0}
      canMoveDown={index < sorted.length - 1}
      onMoveUp={() => reorder(index, -1)}
      onMoveDown={() => reorder(index, 1)}
      onDelete={() => remove.mutate(banner.id)}
      onFeedback={onFeedback}
      onRefresh={refresh}
    />)}
    {!sorted.length ? <StateView title="لا توجد بانرات" message="أضف أول بانر من النموذج أدناه." /> : null}

    <Surface style={styles.addCard}>
      <AppText variant="h3">إضافة بانر جديد</AppText>
      <ProductImageEditor currentImageUrl={null} value={newImage} onChange={setNewImage} onError={(message) => onFeedback(message, true)} title="صورة البانر" description="صورة عريضة تناسب واجهة المتجر (JPG أو PNG أو WEBP حتى 5 ميغابايت)." />
      <Field label="العنوان" value={newTitle} onChangeText={setNewTitle} />
      <Field label="الرابط (اختياري)" placeholder="https://" autoCapitalize="none" value={newLink} onChangeText={setNewLink} />
      <OfferFields value={newOffer} onChange={setNewOffer} />
      <Button label="إضافة البانر" loading={create.isPending} disabled={!newImage || newTitle.trim().length < 1 || offerInput(newOffer) === undefined} onPress={() => create.mutate()} />
    </Surface>
  </View>;
}

function BannerRow({ banner, phone, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onDelete, onFeedback, onRefresh }: {
  banner: OperationsPromoBanner; phone: boolean; canMoveUp: boolean; canMoveDown: boolean;
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
  onFeedback: (message: string, error?: boolean) => void; onRefresh: () => Promise<unknown>;
}) {
  const data = useData();
  const [editing, setEditing] = useState(false);
  const [titleAr, setTitleAr] = useState(banner.titleAr);
  const [linkUrl, setLinkUrl] = useState(banner.linkUrl ?? '');
  const [expiresAt, setExpiresAt] = useState(toDateInput(banner.expiresAt));
  const [image, setImage] = useState<ProductImageFile | null>(null);
  const [offer, setOffer] = useState<OfferDraft>(() => offerDraftOf(banner));

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      await data.operations.updateBanner({
        id: banner.id, titleAr: titleAr.trim(), linkUrl: linkUrl.trim() || null, active: banner.active,
        expiresAt: fromDateInput(expiresAt), image: image ?? undefined, offer: offerInput(offer) ?? null,
      });
    },
    onSuccess: async () => { await onRefresh(); setImage(null); setEditing(false); onFeedback('تم حفظ تعديلات البانر.'); },
    onError: (error) => onFeedback(operationsErrorMessage(error), true),
  });

  const toggleActive = useMutation({
    mutationFn: async () => {
      if (!data) return;
      await data.operations.updateBanner({ id: banner.id, titleAr: banner.titleAr, linkUrl: banner.linkUrl, active: !banner.active, expiresAt: banner.expiresAt });
    },
    onSuccess: async () => { await onRefresh(); onFeedback(banner.active ? 'تم إيقاف البانر.' : 'تم تفعيل البانر.'); },
    onError: (error) => onFeedback(operationsErrorMessage(error), true),
  });

  const expired = banner.expiresAt ? new Date(banner.expiresAt).getTime() < Date.now() : false;

  return <Surface style={phone ? [styles.row, styles.rowCompact] : styles.row}>
    <View style={styles.rowHeader}>
      {banner.imageUrl ? <Image source={{ uri: banner.imageUrl }} style={styles.thumb} resizeMode="cover" /> : <View style={styles.thumbPlaceholder}><Icon name="image-outline" size={22} color={colors.muted} /></View>}
      <View style={styles.flex}>
        <AppText variant="small" style={styles.semibold}>{banner.titleAr}</AppText>
        <AppText variant="caption" color={colors.muted} numberOfLines={1}>{banner.linkUrl ?? 'بدون رابط'}</AppText>
      </View>
      <View style={styles.badges}>
        <View style={[styles.badge, banner.active && !expired ? styles.badgeActive : styles.badgeInactive]}>
          <AppText variant="caption" color={banner.active && !expired ? colors.successText : colors.muted}>{expired ? 'منتهي' : banner.active ? 'مفعّل' : 'متوقف'}</AppText>
        </View>
        {banner.expiresAt ? <AppText variant="caption" color={colors.muted}>ينتهي: {new Date(banner.expiresAt).toLocaleDateString('ar-SY')}</AppText> : null}
      </View>
    </View>
    <View style={styles.rowActions}>
      <Button label="↑" variant="secondary" disabled={!canMoveUp} onPress={onMoveUp} />
      <Button label="↓" variant="secondary" disabled={!canMoveDown} onPress={onMoveDown} />
      <Button label={editing ? 'إغلاق التعديل' : 'تعديل'} variant="secondary" onPress={() => setEditing((current) => !current)} />
      <Button label={banner.active ? 'إيقاف' : 'تفعيل'} variant="secondary" loading={toggleActive.isPending} onPress={() => toggleActive.mutate()} />
      <Button label="حذف" variant="danger" onPress={onDelete} />
    </View>
    {editing ? <View style={styles.editForm}>
      <ProductImageEditor currentImageUrl={banner.imageUrl} value={image} onChange={setImage} onError={(message) => onFeedback(message, true)} title="صورة البانر" description="اختر صورة جديدة لاستبدال الحالية، أو اتركها لتبقى كما هي." />
      <Field label="العنوان" value={titleAr} onChangeText={setTitleAr} />
      <Field label="الرابط (اختياري)" placeholder="https://" autoCapitalize="none" value={linkUrl} onChangeText={setLinkUrl} />
      <Field label="تاريخ الانتهاء (اختياري)" placeholder="YYYY-MM-DD" value={expiresAt} onChangeText={setExpiresAt} />
      <OfferFields value={offer} onChange={setOffer} />
      <Button label="حفظ التعديلات" loading={save.isPending} disabled={titleAr.trim().length < 1 || offerInput(offer) === undefined} onPress={() => save.mutate()} />
    </View> : null}
  </Surface>;
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  row: { gap: spacing.sm }, rowCompact: { gap: spacing.sm },
  rowHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 72, height: 44, borderRadius: radius.sm, backgroundColor: colors.soft },
  thumbPlaceholder: { width: 72, height: 44, borderRadius: radius.sm, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  badges: { alignItems: 'flex-end', gap: 2 },
  badge: { minHeight: 28, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  badgeActive: { backgroundColor: colors.successSurface }, badgeInactive: { backgroundColor: colors.soft },
  rowActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.xs },
  editForm: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  addCard: { gap: spacing.sm, padding: spacing.md },
  offer: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  offerItem: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  result: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.soft },
  semibold: { fontWeight: '600' },
});
