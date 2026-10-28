# Known issues

- Authentication screens have no approved reference frames; the implementation conservatively extends the store visual language.
- Approved Tawreed app icon, adaptive icon, favicon, and splash artwork were not supplied, so starter Expo image assets remain and must be replaced before release.
- ADB, an Android emulator/device, Maestro, and EAS project credentials are absent, so APK build/start and Android E2E remain unverified.
- Hosted Supabase, EAS, and Vercel configuration must be verified for each release target.
