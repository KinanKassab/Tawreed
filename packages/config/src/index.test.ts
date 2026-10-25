import { describe, expect, it } from 'vitest';
import { parseClientConfig } from './index';

describe('public client configuration', () => {
  it('returns null instead of booting with missing or malformed Supabase values', () => {
    expect(parseClientConfig({})).toBeNull();
    expect(parseClientConfig({ EXPO_PUBLIC_SUPABASE_URL: 'not-a-url', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'short' })).toBeNull();
  });

  it('accepts public values and omits an empty media base URL', () => {
    expect(parseClientConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-key-long-enough',
      EXPO_PUBLIC_MEDIA_PUBLIC_BASE_URL: '',
    })).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'public-key-long-enough',
      mediaPublicBaseUrl: undefined,
    });
  });
});
