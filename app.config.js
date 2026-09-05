module.exports = () => ({
  expo: {
    name: 'Tibro',
    slug: 'Tibro',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'tibro',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSMicrophoneUsageDescription:
          'Cho phép Tibro sử dụng micro để thực hiện cuộc gọi thoại và video.',
        NSCameraUsageDescription:
          'Cho phép Tibro sử dụng camera để thực hiện cuộc gọi video.',
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.hibio.tibro',
      permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
        },
      },
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/Logo_tibro_removebg.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#0B0F1A',
          dark: {
            backgroundColor: '#0B0F1A',
          },
        },
      ],
      'expo-secure-store',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Cho phép $(PRODUCT_NAME) sử dụng vị trí của bạn để theo dõi và chia sẻ với bạn bè.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Cho phép $(PRODUCT_NAME) truy cập thư viện ảnh để bạn có thể cập nhật ảnh đại diện.',
        },
      ],
      'expo-font',
      'expo-image',
      'expo-status-bar',
      '@livekit/react-native-expo-plugin',
      '@config-plugins/react-native-webrtc',
    ],
    experiments: {
      typedRoutes: false,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '005c0b3e-34a8-4b2d-9580-c6e9096726fe',
      },
    },
  },
});
