// =========================================================
// app/login.tsx — Layout 2 phần: top (header) + bottom (form)
// KHÔNG thay đổi logic xác thực
// Đăng nhập bằng email; không tra cứu email công khai từ username.
// =========================================================

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { loginUser } from '../services/authService';
import { supabase } from '../services/supabaseConfig';
import { Colors } from '../styles/colors';
import { FontSize } from '../styles/globalStyles';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // =========================================================
  // Xử lý đăng nhập bằng email
  // =========================================================
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(email.trim(), password);
      if (user) {
        // Kiểm tra tài khoản có bị ban không (nếu lỗi thì bỏ qua)
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('is_banned')
            .eq('id', user.id)
            .single();

          if (profile?.is_banned === true) {
            await supabase.auth.signOut();
            setLoading(false);
            router.replace('/banned' as any);
            return;
          }
        } catch {
          // Bỏ qua nếu cột is_banned chưa tồn tại
        }

        router.replace('/');
      }
    } catch (error: any) {
      const msg: string = error?.message ?? '';
      let message = 'Đăng nhập thất bại. Vui lòng thử lại.';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials'))
        message = 'Email hoặc mật khẩu không đúng.';
      else if (msg.includes('Email not confirmed'))
        message = 'Tài khoản chưa được xác minh. Vui lòng kiểm tra email.';
      else if (msg.includes('too many requests') || msg.includes('rate limit'))
        message = 'Quá nhiều lần thử. Vui lòng thử lại sau.';
      else if (msg.includes('User not found'))
        message = 'Không tìm thấy tài khoản với email này.';
      else if (msg) message = msg;
      Alert.alert('Đăng nhập thất bại', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.black} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── TOP SECTION (màu nền) ── */}
          <View style={styles.topSection}>
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              <View style={styles.brandHeader}>
                <ExpoImage
                  source={require('../assets/images/Logo_tibro_noname_removebg.png')}
                  style={styles.logoIcon}
                  contentFit="contain"
                  transition={0}
                />
                <ExpoImage
                  source={require('../assets/images/Logo_name_tibro_removebg.png')}
                  style={styles.logoName}
                  contentFit="contain"
                  transition={0}
                />
              </View>
              <Text style={styles.title}>Chào mừng{'\n'}trở lại!</Text>
              <Text style={styles.subtitle}>Đăng nhập để tiếp tục chia sẻ vị trí cùng bạn bè.</Text>
            </Animated.View>
          </View>

          {/* ── BOTTOM SECTION (trắng) ── */}
          <View style={styles.bottomSection}>
            <CustomInput
              label="Email"
              placeholder="Nhập địa chỉ email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              accentColor={Colors.primary}
            />
            <CustomInput
              label="Mật khẩu"
              placeholder="Nhập mật khẩu"
              isPassword
              value={password}
              onChangeText={setPassword}
              accentColor={Colors.primary}
            />

            <TouchableOpacity
              onPress={() => router.push('/forgot-password' as any)}
              style={styles.forgotBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <CustomButton
              label="Đăng Nhập"
              onPress={handleLogin}
              loading={loading}
              color={Colors.primary}
              style={styles.actionBtn}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.linkRow}>
              <Text style={styles.linkLabel}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.push('/register' as any)} activeOpacity={0.7}>
                <Text style={[styles.linkText, { color: Colors.primary }]}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const TOP_BG = Colors.black;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOP_BG },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  topSection: {
    backgroundColor: TOP_BG,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 36,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  logoIcon: { width: 48, height: 48 },
  logoName: { width: 100, height: 36, marginTop: 4 },
  title: {
    fontSize: 32, fontWeight: '800', color: Colors.textPrimary,
    letterSpacing: -0.5, lineHeight: 38, marginBottom: 10,
  },
  subtitle: {
    fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22,
  },

  bottomSection: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    marginTop: -2,
  },

  forgotBtn: { alignSelf: 'flex-end', marginTop: 4, marginBottom: 8 },
  forgotText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },

  actionBtn: { marginTop: 12 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.gray200 },
  dividerText: { fontSize: FontSize.sm, color: Colors.textMuted },

  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  linkLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  linkText: { fontSize: FontSize.sm, fontWeight: '700' },
});
