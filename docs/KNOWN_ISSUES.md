# Known issues

- Authentication screens have no approved reference frames; the implementation conservatively extends the store visual language.
- Approved Tawreed app icon, adaptive icon, favicon, and splash artwork were not supplied, so starter Expo image assets remain and must be replaced before release.
- ADB, an Android emulator/device, Maestro, and EAS project credentials are absent, so APK build/start and Android E2E remain unverified.
- Hosted Supabase, Twilio, EAS, and Vercel configuration is absent, so live integration and deployment checks remain unverified.
- Independent WhatsApp signup remains intentionally disabled pending a safe email/phone account-linking decision.
