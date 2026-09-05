// LiveKit's React Native globals rely on native WebRTC modules. Browser builds
// already provide their own WebRTC globals and must not load that native package.
export function getLiveKitNativeModule() {
  return null;
}

export function registerLiveKitGlobals() {}
