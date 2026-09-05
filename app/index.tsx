// =========================================================
// app/index.tsx
// Entry point của ứng dụng.
// Render Splash Screen TRỰC TIẾP (không dùng router.replace)
// để tránh lỗi "navigate before mounting Root Layout".
// Sau khi splash xong → checkAppState() → navigate phù hợp.
// =========================================================

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { isIntroShown } from '../utils/storage';
import { clearLocalAuthState } from '../services/authService';
import { supabase } from '../services/supabaseConfig';
import { Colors } from '../styles/colors';

const { width } = Dimensions.get('window');

// Các trạng thái có thể của màn hình này
type AppState = 'splash' | 'checking' | 'home';

export default function HomeScreen() {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState>('splash');

  // ---- Splash animation values ----
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;

  // =========================================================
  // Splash animation + sau đó checkAppState
  // =========================================================
  function runSplashThenCheck() {
    // 1. Animation xuất hiện (Entrance)
    Animated.sequence([
      Animated.delay(500), // Đợi 500ms để JS thread ổn định sau khi mount
      Animated.parallel([
        Animated.timing(fadeAnim, { 
          toValue: 1, 
          duration: 1200, 
          useNativeDriver: true 
        }),
        Animated.timing(scaleAnim, { 
          toValue: 1, 
          duration: 1200,
          // Easing.back tạo hiệu ứng hơi nảy nhẹ giống lò xo nhưng mượt hơn
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true 
        }),
      ]),
      Animated.parallel([
        Animated.timing(slideAnim, { 
          toValue: 0, 
          duration: 800, 
          useNativeDriver: true 
        }),
      ]),
    ]).start(() => {
      // 2. Sau khi hiện xong mới bắt đầu cho logo "thở"
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, { 
            toValue: 1.05, 
            duration: 2000, 
            useNativeDriver: true 
          }),
          Animated.timing(breathAnim, { 
            toValue: 1, 
            duration: 2000, 
            useNativeDriver: true 
          }),
        ])
      ).start();

      // 3. Đợi một khoảng thời gian rồi mới chuyển màn hình
      setTimeout(() => {
        setAppState('checking');
        checkAppState();
      }, 3000);
    });
  }

  // =========================================================
  // Kiểm tra trạng thái app và điều hướng
  // =========================================================
  async function checkAppState() {
    try {
      // Kiểm tra bảo trì hệ thống trước
      try {
        const { data: config } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'maintenance')
          .single();

        if (config?.value?.enabled === true) {
          router.replace({
            pathname: '/maintenance',
            params: {
              message: config.value.message || '',
              estimatedTime: config.value.estimated_time || '',
            },
          } as any);
          return;
        }
      } catch {
        // Bỏ qua nếu bảng chưa tồn tại
      }

      const introShown = await isIntroShown();
      if (!introShown) {
        router.replace('/intro' as any);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        await clearLocalAuthState();
        router.replace('/login' as any);
        return;
      }

      // getSession() only reads the cached JWT. getUser() contacts Supabase Auth
      // and detects users deleted from the Dashboard.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        await clearLocalAuthState();
        router.replace('/login' as any);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('is_banned')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await clearLocalAuthState();
        router.replace('/login' as any);
        return;
      }

      if (profile.is_banned === true) {
        await clearLocalAuthState();
        router.replace('/banned' as any);
        return;
      }

      // Đã đăng nhập → hiển thị Tabs chính
      router.replace('/(tabs)/map' as any);
    } catch {
      router.replace('/login' as any);
    }
  }

  useEffect(() => {
    // Chạy splash animation rồi check auth
    runSplashThenCheck();
    // Bootstrap splash chỉ chạy đúng một lần; các Animated.Value đều là refs ổn định.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================
  // Render: Splash Screen
  // =========================================================
  if (appState === 'splash') {
    return (
      <View style={splashStyles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0F1A" />

        {/* Deep Indigo Gradient Background */}
        <LinearGradient
          colors={['#0B0F1A', '#0D0E25', '#1E1B4B', '#0B0F1A']}
          style={StyleSheet.absoluteFill}
        />

        {/* Decorative Blurred Orbs */}
        <View style={[splashStyles.orb, splashStyles.orb1]} />
        <View style={[splashStyles.orb, splashStyles.orb2]} />

        <Animated.View
          style={[
            splashStyles.logoContainer,
            { 
              opacity: fadeAnim, 
              transform: [
                { scale: Animated.multiply(scaleAnim, breathAnim) }
              ] 
            },
          ]}
        >
          <View style={splashStyles.logoShadow} />
          <ExpoImage 
            source={require('../assets/images/Logo_tibro_noname_removebg.png')} 
            style={splashStyles.logoImage}
            contentFit="contain"
            transition={0} // Tắt hiệu ứng mặc định của expo-image để dùng animation của chúng ta
          />
        </Animated.View>

        {/* Brand Name Image */}
        <Animated.View
          style={{ 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            marginTop: 10,
            alignItems: 'center'
          }}
        >
          <ExpoImage 
            source={require('../assets/images/Logo_name_tibro_removebg.png')} 
            style={splashStyles.nameImage}
            contentFit="contain"
            transition={0}
          />
          <Text style={splashStyles.tagline}>Xây dựng cộng đồng quanh bạn</Text>
        </Animated.View>

        {/* Bottom Area */}
        <Animated.View style={[splashStyles.bottomArea, { opacity: fadeAnim }]}>
          <View style={splashStyles.loadingBarContainer}>
            <View style={splashStyles.loadingBarActive} />
          </View>
          <Text style={splashStyles.version}>v1.0.0</Text>
        </Animated.View>
      </View>
    );
  }

  // =========================================================
  // Render: Checking / Loading
  // =========================================================
  if (appState === 'checking') {
    return (
      <View style={homeStyles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={homeStyles.loadingText}>Đang khởi động...</Text>
      </View>
    );
  }

  // Component UI này sẽ hiếm khi được nhìn thấy vì router.replace
  // đã chuyển ngay sang /(tabs). Tạm trả về view rỗng.
  return <View style={homeStyles.homeContainer} />;
}

// =========================================================
// Slash/Loading Styles
// =========================================================
const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.1,
  },
  orb1: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: Colors.primary,
    top: -50,
    right: -100,
  },
  orb2: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: '#818CF8',
    bottom: 50,
    left: -80,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoShadow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary,
    opacity: 0.15,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
  nameImage: {
    width: 220,
    height: 80,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -5,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  bottomArea: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    width: '100%',
  },
  loadingBarContainer: {
    width: 100,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingBarActive: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primary,
  },
  version: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  },
});

const homeStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  loadingText: {
    marginTop: 12, fontSize: 14, color: Colors.textMuted,
  },
  homeContainer: {
    flex: 1, backgroundColor: Colors.white,
  },
});
