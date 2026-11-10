import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CatalogFilters } from '@tawreed/data';
import { useData } from '@/providers/app-providers';

export function useCategories() { const data = useData(); return useQuery({ queryKey: ['categories'], queryFn: () => data!.catalog.listCategories(), enabled: Boolean(data) }); }
export function useBanners() { const data = useData(); return useQuery({ queryKey: ['banners'], queryFn: () => data!.catalog.listBanners(), enabled: Boolean(data) }); }
export function useProducts(filters: CatalogFilters = {}) { const data = useData(); return useQuery({ queryKey: ['products', filters], queryFn: ({ signal }) => data!.catalog.listProducts({ ...filters, signal }), enabled: Boolean(data) }); }
export function useInfiniteProducts(filters: Omit<CatalogFilters, 'limit' | 'offset' | 'signal'> = {}, pageSize = 30) { const data = useData(); return useInfiniteQuery({ queryKey: ['products', 'infinite', filters, pageSize], queryFn: ({ pageParam, signal }) => data!.catalog.listProducts({ ...filters, limit: pageSize, offset: pageParam, signal }), initialPageParam: 0, getNextPageParam: (lastPage, pages) => lastPage.length === pageSize ? pages.length * pageSize : undefined, placeholderData: keepPreviousData, enabled: Boolean(data) }); }
export function useProduct(id: string) { const data = useData(); return useQuery({ queryKey: ['product', id], queryFn: () => data!.catalog.getProduct(id), enabled: Boolean(data && id) }); }
