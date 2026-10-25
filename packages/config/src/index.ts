import { z } from 'zod';

const clientConfigSchema = z.object({
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(10),
  mediaPublicBaseUrl: z.url().optional(),
});

export type ClientConfig = z.infer<typeof clientConfigSchema>;

export function parseClientConfig(input: Record<string, string | undefined>): ClientConfig | null {
  const parsed = clientConfigSchema.safeParse({
    supabaseUrl: input.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: input.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    mediaPublicBaseUrl: input.EXPO_PUBLIC_MEDIA_PUBLIC_BASE_URL || undefined,
  });
  return parsed.success ? parsed.data : null;
}
