# Known issues

- Production signup activation emails are not reaching recipients. Supabase accepted the latest `/resend` request with HTTP 200, but the Resend dashboard showed no sent emails and `Tawreed Production` showed `No activity`; replace the Supabase SMTP password with a fresh domain-restricted Resend sending key, then verify a real inbox.
- Authentication screens have no approved reference frames; the implementation conservatively extends the store visual language.
- Approved Tawreed app icon, adaptive icon, favicon, and splash artwork were not supplied, so starter Expo image assets remain and must be replaced before release.
- ADB, an Android emulator/device, Maestro, and EAS project credentials are absent, so APK build/start and Android E2E remain unverified.
- Hosted Supabase, EAS, and Vercel configuration must be verified for each release target.
