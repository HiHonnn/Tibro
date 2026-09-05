import Constants, { AppOwnership } from 'expo-constants';
import { Platform } from 'react-native';

export type LiveKitNativeModule = typeof import('@livekit/react-native');

let registered = false;
let resolved = false;
let liveKitModule: LiveKitNativeModule | null = null;

export function getLiveKitNativeModule(): LiveKitNativeModule | null {
  if (Platform.OS === 'web' || Constants.appOwnership === AppOwnership.Expo) return null;
  if (resolved) return liveKitModule;

  resolved = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    liveKitModule = require('@livekit/react-native') as LiveKitNativeModule;
  } catch (error) {
    console.warn('[LiveKit] Native WebRTC is unavailable in this build:', error);
    liveKitModule = null;
  }
  return liveKitModule;
}

export function registerLiveKitGlobals() {
  if (registered) return;

  const nativeModule = getLiveKitNativeModule();
  if (!nativeModule) return;
  nativeModule.registerGlobals();
  registered = true;
}
