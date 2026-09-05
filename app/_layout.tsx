import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { CurrentUserProvider } from '../hooks/useCurrentUser';
import { LocationProvider } from '../hooks/useLocation';
import { supabase } from '../services/supabaseConfig';
import { registerLiveKitGlobals } from '../utils/registerLiveKitGlobals';
import './globals.css';

registerLiveKitGlobals();

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // Luôn cập nhật pathname mới nhất
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // ---- Polling kiểm tra bảo trì mỗi 30s ----
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const checkMaintenance = async () => {
      // Bỏ qua nếu đang ở trang maintenance, login, intro, register, splash
      const skip = ['/maintenance', '/login', '/intro', '/register', '/verify-otp', '/forgot-password', '/banned'];
      if (skip.some(s => pathnameRef.current.startsWith(s))) return;
      // Bỏ qua nếu đang ở trang index (splash)
      if (pathnameRef.current === '/') return;

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
        }
      } catch {
        // Bỏ qua nếu bảng chưa tồn tại
      }
    };

    // Check ngay khi mount, rồi mỗi 30s
    const startPolling = () => {
      checkMaintenance();
      timer = setInterval(checkMaintenance, 30000);
    };

    startPolling();

    // Khi app quay lại foreground → check ngay
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkMaintenance();
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [router]);

  return (
    <CurrentUserProvider>
    <LocationProvider>
    <Stack>
      {/* Màn hình chính sau khi đăng nhập */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="history/[userId]"
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="history/map-detail"
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="camera"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen
        name="call"
        options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
      />
      {/* Màn hình chính (Home) */}
      <Stack.Screen name="index" options={{ title: 'Tibro', headerShown: false }} />

      {/* Màn hình giới thiệu - ẩn header */}
      <Stack.Screen name="intro" options={{ headerShown: false }} />

      {/* Màn hình xác thực - ẩn header */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
      <Stack.Screen name="radar" options={{ headerShown: false, animation: 'slide_from_bottom' }} />

      {/* Bảo trì & Ban */}
      <Stack.Screen name="maintenance" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="banned" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
    </LocationProvider>
    </CurrentUserProvider>
  );
}
