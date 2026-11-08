import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Modal, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@tawreed/design-tokens';
import { calculateSubtotal, formatMoney, type BundleItem, type Product } from '@tawreed/domain';
import { AppText, Button, Icon, Surface } from '@tawreed/ui';
import { useData } from '@/providers/app-providers';
import { useCart } from '@/store/cart';

export function BundleOfferModal({ visible, bannerId, titleAr, items, onClose }: {
  visible: boolean; bannerId: string; titleAr: string; items: BundleItem[]; onClose: () => void;
}) {
  const data = useData();
  const addBundle = useCart((state) => state.addBundle);
  const queries = useQueries({ queries: items.map((item) => ({ queryKey: ['product', item.productId], queryFn: () => data!.catalog.getProduct(item.productId), enabled: Boolean(data && visible) })) });
  const products = queries.map((query) => query.data).filter((product): product is Product => Boolean(product));
  const loading = queries.some((query) => query.isLoading);
  const pricedProducts = products.filter((product): product is Product & { price: NonNullable<Product['price']> } => product.price !== null);
  const total = calculateSubtotal(pricedProducts.map((product) => ({ quantity: items.find((item) => item.productId === product.id)?.quantity ?? 1, unitPriceMinor: product.price.amountMinor })));
  const ready = !loading && pricedProducts.length === items.length;
  const currency = pricedProducts[0]?.price.currency;
  const roundedTotal = ready ? Math.floor(total / 10 ** pricedProducts[0].price.decimalPlaces) : null;
  const offerLabel = roundedTotal !== null ? `عرض الـ${roundedTotal} ${currency === 'USD' ? 'دولار' : 'ل.س'}` : titleAr;

  const confirm = () => {
    addBundle({ id: bannerId, label: offerLabel, productIds: items.map((item) => item.productId) }, items);
    onClose();
    router.push('/cart');
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}>
      <View style={styles.backdrop}>
        <Surface accessibilityLabel={titleAr} accessibilityViewIsModal role="dialog" style={styles.dialog}>
          <View style={styles.icon}><Icon name="currency-usd" size={28} color={colors.primary} /></View>
          <AppText variant="h2" style={styles.center}>{titleAr}</AppText>
          <AppText color={colors.textMuted} style={styles.center}>هيدا العرض بيضيف المنتجات التالية للسلة دفعة وحدة:</AppText>
          <View style={styles.list}>
            {items.map((item) => {
              const product = products.find((candidate) => candidate.id === item.productId);
              return <View key={item.productId} style={styles.row}>
                <AppText variant="small" color={colors.textMuted}>{item.quantity > 1 ? `${item.quantity} ×` : ''}</AppText>
                <AppText variant="small" style={styles.grow}>{product?.nameAr ?? '...'}</AppText>
              </View>;
            })}
          </View>
          {ready ? <View style={styles.totalRow}><AppText color={colors.primary} variant="h3">{formatMoney({ amountMinor: total, currency: pricedProducts[0].price.currency, decimalPlaces: pricedProducts[0].price.decimalPlaces })}</AppText><AppText color={colors.textMuted}>سعر العرض</AppText></View> : null}
          <View style={styles.actions}>
            <Button label="ضيف العرض للسلة" onPress={confirm} loading={loading} disabled={loading} />
            <Button label="ليس الآن" variant="quiet" onPress={onClose} />
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: colors.overlay },
  dialog: { width: '100%', maxWidth: 420, gap: spacing.md, borderColor: colors.primary, borderRadius: radius.xl, elevation: 2, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 18 },
  icon: { width: 56, height: 56, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.primarySoft },
  center: { textAlign: 'center' },
  list: { gap: spacing.xs },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs },
  grow: { flex: 1, textAlign: 'right' },
  totalRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md },
  actions: { gap: spacing.xs },
});
