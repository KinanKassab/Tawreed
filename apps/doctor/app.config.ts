import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return {
    ...config,
    ios: {
      ...config.ios,
      config: googleMapsApiKey ? { ...config.ios?.config, googleMapsApiKey } : config.ios?.config,
    },
    android: {
      ...config.android,
      config: googleMapsApiKey
        ? { ...config.android?.config, googleMaps: { apiKey: googleMapsApiKey } }
        : config.android?.config,
    },
  } as ExpoConfig;
};
