import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const googleMapsIosApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  return {
    ...config,
    ios: {
      ...config.ios,
      config: googleMapsIosApiKey
        ? { ...config.ios?.config, googleMapsApiKey: googleMapsIosApiKey }
        : config.ios?.config,
    },
    android: {
      ...config.android,
      config: googleMapsAndroidApiKey
        ? { ...config.android?.config, googleMaps: { apiKey: googleMapsAndroidApiKey } }
        : config.android?.config,
    },
  } as ExpoConfig;
};
