-- SECURITY INVOKER search calls these deterministic helpers as the requesting
-- role. They expose no table data and therefore are safe for catalog clients.
grant execute on function public.normalize_catalog_search(text) to anon, authenticated;
grant execute on function public.catalog_prefix_tsquery(text) to anon, authenticated;
