export const mainDestinations = [
  { label: 'الرئيسية', icon: 'home-outline', activeIcon: 'home', href: '/(app)/(tabs)' as const, matches: (path: string) => path === '/' },
  { label: 'الأقسام', icon: 'view-grid-outline', activeIcon: 'view-grid', href: '/(app)/(tabs)/catalog' as const, matches: (path: string) => path === '/catalog' || path.startsWith('/product/') },
  { label: 'السلة', icon: 'cart-outline', activeIcon: 'cart', href: '/cart' as const, matches: (path: string) => path === '/cart' || path === '/checkout' },
  { label: 'طلباتي', icon: 'clipboard-text-outline', activeIcon: 'clipboard-text', href: '/(app)/(tabs)/orders' as const, returnTo: '/orders' as const, matches: (path: string) => path === '/orders' || path.startsWith('/order/') || path === '/order-success' },
  { label: 'حسابي', icon: 'account-outline', activeIcon: 'account', href: '/(app)/(tabs)/account' as const, returnTo: '/account' as const, matches: (path: string) => path === '/account' || path === '/support' },
] as const;

export const mainPathIndex = (path: string) => mainDestinations.findIndex((destination) => destination.matches(path));

export const isMainSwipePath = (path: string) => path === '/' || path === '/catalog' || path === '/cart' || path === '/orders' || path === '/account';
