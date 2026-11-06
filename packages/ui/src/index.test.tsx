import type { ReactElement } from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Product } from '@tawreed/domain';
import { AvailabilityBadge, ProductCard } from './index';

vi.mock('expo-image', () => ({ Image: 'ExpoImage' }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const baseProduct: Product = {
  id: 'product-1',
  sku: 'TST-001',
  nameAr: 'قفازات فحص طبية',
  nameEn: 'Medical examination gloves',
  manufacturer: 'Tawreed Test',
  unitLabelAr: 'علبة',
  packageLabelAr: '١٠٠ قطعة',
  descriptionAr: null,
  specificationsAr: null,
  availability: 'available',
  category: { id: 'category-1', slug: 'consumables', nameAr: 'مستهلكات', nameEn: 'Consumables' },
  price: { amountMinor: 2400, currency: 'USD', decimalPlaces: 2 },
  priceOnRequest: false,
  media: null,
  variantLabelAr: null,
  variants: [],
};

async function render(node: ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(node); });
  return renderer;
}

function findButton(root: ReactTestInstance): ReactTestInstance {
  return root.find((node) => node.props.accessibilityRole === 'button');
}

describe('shared Doctor UI', () => {
  it('renders each Arabic availability state', async () => {
    for (const [value, label] of [['available', 'متوفر'], ['limited', 'محدود'], ['unavailable', 'غير موجود']] as const) {
      const renderer = await render(<AvailabilityBadge value={value} />);
      expect(JSON.stringify(renderer.toJSON())).toContain(label);
      await act(async () => renderer.unmount());
    }
  });

  it('calls add for an available product', async () => {
    const onAdd = vi.fn();
    const renderer = await render(<ProductCard product={baseProduct} imageUrl={null} onPress={vi.fn()} onAdd={onAdd} />);
    const button = findButton(renderer.root);
    await act(async () => button.props.onPress());
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('disables ordering for an unavailable product', async () => {
    const renderer = await render(<ProductCard product={{ ...baseProduct, availability: 'unavailable' }} imageUrl={null} onPress={vi.fn()} onAdd={vi.fn()} />);
    const button = findButton(renderer.root);
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain('غير متاح للطلب');
  });

  it('offers a quote request for a product priced on request', async () => {
    const onAdd = vi.fn();
    const renderer = await render(<ProductCard product={{ ...baseProduct, price: null, priceOnRequest: true }} imageUrl={null} onPress={vi.fn()} onAdd={onAdd} />);
    expect(JSON.stringify(renderer.toJSON())).toContain('حسب الطلب');
    const button = findButton(renderer.root);
    expect(button.props.accessibilityState.disabled).toBe(false);
    await act(async () => button.props.onPress());
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
