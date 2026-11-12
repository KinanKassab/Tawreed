import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { OperationsProduct } from '@tawreed/domain';
import { useData } from '@/providers/app-providers';

const SEARCH_DEBOUNCE_MS = 250;

const literalText = (product: Pick<OperationsProduct, 'nameAr' | 'sku' | 'variantLabelAr'>) =>
  `${product.nameAr} ${product.sku} ${product.variantLabelAr ?? ''}`.toLocaleLowerCase('ar');

/**
 * Smart product search for Operations, backed by the same catalog search as the doctor app (typos, synonyms, SKUs),
 * with archived products included. Product lists are already loaded here, so the search only ranks ids; the plain
 * text match is kept as well, so a product that matched before never drops out while the request runs or if it fails.
 */
export function useProductSearch(search: string) {
  const data = useData();
  const term = search.trim();
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const ranks = useQuery({
    queryKey: ['operations-product-search', debounced],
    queryFn: ({ signal }) => data!.operations.searchProductRanks(debounced, signal),
    enabled: Boolean(data && debounced),
    staleTime: 30_000,
  });

  return useMemo(() => {
    const needle = term.toLocaleLowerCase('ar');
    // Ranks from an earlier search are not reused for a new one; until they arrive, the plain text match decides.
    const rankMap = debounced === term && term ? ranks.data : undefined;
    const rankOf = (product: Pick<OperationsProduct, 'id'>) => rankMap?.get(product.id) ?? 0;
    const matches = (product: Pick<OperationsProduct, 'id' | 'nameAr' | 'sku' | 'variantLabelAr'>) =>
      !needle || rankMap?.has(product.id) || literalText(product).includes(needle);
    return { active: Boolean(needle), matches, rankOf, pending: term !== debounced || ranks.isFetching };
  }, [debounced, ranks.data, ranks.isFetching, term]);
}
