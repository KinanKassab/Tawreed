import { parseClientConfig } from '@tawreed/config';

export const clientConfig = parseClientConfig({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_MEDIA_PUBLIC_BASE_URL: process.env.EXPO_PUBLIC_MEDIA_PUBLIC_BASE_URL,
});
