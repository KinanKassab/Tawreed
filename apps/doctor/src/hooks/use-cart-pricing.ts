import { useQueries } from '@tanstack/react-query';
import { calculateSubtotal, type BundleItem, type Money, type Product, type PromoBanner } from '@tawreed/domain';
import { useBanners } from '@/hooks/use-catalog';
import { useData } from '@/providers/app-providers';
import { useCart } from '@/store/cart';

type PricedProduct = Product & { price: NonNullable<Product['price']> };
export interface AppliedBundle { id: string; label: string; items: BundleItem[]; priceUsd: Money; priceSyp: Money }
/** A product charged at list price; `reserved` units of it already belong to an offer. */
export interface LooseLine { product: Product; quantity: number; reserved: number }

export const isSellableOffer = (banner: PromoBanner) => Boolean(banner.bundleItems?.length && banner.bundlePriceUsd && banner.bundlePriceSyp);
export const offerLabel = (priceUsd: Money) => `عرض الـ${priceUsd.amountMinor / 10 ** priceUsd.decimalPlaces} دولار`;

/** Cart totals shared by the cart and the invoice. Mirrors how create_doctor_order applies fixed-price offers. */
export function useCartPricing() {
  const data = useData();
  const items = useCart((state) => state.items);
  const cartBundles = useCart((state) => state.bundles);
  const banners = useBanners();
  const ids = Object.keys(items);
  const queries = useQueries({ queries: ids.map((id) => ({ queryKey: ['product', id], queryFn: () => data!.catalog.getProduct(id), enabled: Boolean(data) })) });
  const products = queries.map((query) => query.data).filter((product): product is Product => Boolean(product));
  const pricedProducts = products.filter((product): product is PricedProduct => product.price !== null);

  const reserved: Record<string, number> = {};
  const bundles: AppliedBundle[] = [];
  for (const { id } of cartBundles) {
    const banner = banners.data?.find((candidate) => candidate.id === id);
    if (!banner || !isSellableOffer(banner)) continue;
    const bundleItems = banner.bundleItems!;
    if (!bundleItems.every((item) => (items[item.productId] ?? 0) - (reserved[item.productId] ?? 0) >= item.quantity)) continue;
    bundleItems.forEach((item) => { reserved[item.productId] = (reserved[item.productId] ?? 0) + item.quantity; });
    bundles.push({ id, label: offerLabel(banner.bundlePriceUsd!), items: bundleItems, priceUsd: banner.bundlePriceUsd!, priceSyp: banner.bundlePriceSyp! });
  }

  const looseLines: LooseLine[] = products
    .map((product) => ({ product, quantity: (items[product.id] ?? 0) - (reserved[product.id] ?? 0), reserved: reserved[product.id] ?? 0 }))
    .filter((line) => line.quantity > 0);
  const looseSubtotal = calculateSubtotal(looseLines.flatMap((line) => line.product.price ? [{ quantity: line.quantity, unitPriceMinor: line.product.price.amountMinor }] : []));
  const subtotal = looseSubtotal + bundles.reduce((sum, bundle) => sum + bundle.priceSyp.amountMinor, 0);

  return {
    ids,
    products,
    bundles,
    looseLines,
    subtotal,
    currency: pricedProducts[0]?.price.currency ?? bundles[0]?.priceSyp.currency ?? 'NEW_SYP',
    decimalPlaces: pricedProducts[0]?.price.decimalPlaces ?? bundles[0]?.priceSyp.decimalPlaces ?? 0,
    loading: queries.some((query) => query.isLoading) || (cartBundles.length > 0 && banners.isLoading),
    failed: queries.some((query) => query.isError) || (cartBundles.length > 0 && banners.isError),
    canCheckout: products.length === ids.length && products.every((product) => product.price && product.availability !== 'unavailable'),
  };
}
