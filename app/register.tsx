// =========================================================
// app/register.tsx — Layout 2 phần: top (header) + bottom (form)
// KHÔNG thay đổi logic xác thực
// =========================================================

import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
import { sendOTP } from '../services/otpService';
import { saveRegistrationDraft } from '../services/registrationDraft';
import { supabase } from '../services/supabaseConfig';
import { Colors } from '../styles/colors';
import { FontSize } from '../styles/globalStyles';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
  // Gửi OTP — KHÔNG THAY ĐỔI LOGIC
  // =========================================================
  const handleRegister = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) { Alert.alert('Lỗi', 'Vui lòng nhập tên đăng nhập.'); return; }
    if (!/^[a-zA-Z0-9_.]+$/.test(trimmedUsername)) { Alert.alert('Lỗi', 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu chấm (.) và dấu gạch dưới (_), không có khoảng trắng.'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { Alert.alert('Lỗi', 'Email không hợp lệ.'); return; }
    if (password.length < 8) { Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    if (password !== confirmPassword) { Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp.'); return; }

    setLoading(true);
    try {
      // KIỂM TRA TÊN ĐĂNG NHẬP (USERNAME) ĐÃ TỒN TẠI HAY CHƯA
      const { data: isAvailable, error } = await supabase
        .rpc('is_username_available', { candidate: trimmedUsername });

      if (error) {
        throw new Error('Không thể kiểm tra tên đăng nhập. Vui lòng thử lại.');
      }
      if (!isAvailable) {
        Alert.alert('Tên đăng nhập đã tồn tại', 'Vui lòng chọn một tên đăng nhập khác.');
        setLoading(false);
        return;
      }

      await sendOTP(email.trim(), 'signup');
      saveRegistrationDraft({ email: email.trim(), username: trimmedUsername, password });
      router.push({ pathname: '/verify-otp', params: { mode: 'register', email: email.trim() } });
    } catch (error: any) {
      Alert.alert('Lỗi gửi mã OTP', error.message || 'Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.black} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── TOP SECTION ── */}
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
              <Text style={styles.title}>Tạo tài khoản</Text>
              <Text style={styles.subtitle}>Gia nhập cộng đồng Tibro và bắt đầu chia sẻ vị trí!</Text>
            </Animated.View>
          </View>

          {/* ── BOTTOM SECTION ── */}
          <View style={styles.bottomSection}>
            <CustomInput label="Tên đăng nhập" placeholder="Nhập tên đăng nhập (vd: hihon123)" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} accentColor={Colors.success} />
            <CustomInput label="Email" placeholder="Nhập địa chỉ email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} accentColor={Colors.success} />
            <CustomInput label="Mật khẩu" placeholder="Tối thiểu 8 ký tự" isPassword value={password} onChangeText={setPassword} accentColor={Colors.success} />
            <CustomInput label="Xác nhận mật khẩu" placeholder="Nhập lại mật khẩu" isPassword value={confirmPassword} onChangeText={setConfirmPassword} accentColor={Colors.success} />

            <CustomButton label="Gửi mã xác nhận" onPress={handleRegister} loading={loading} color={Colors.success} style={styles.actionBtn} />

            <View style={styles.linkRow}>
              <Text style={styles.linkLabel}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={[styles.linkText, { color: Colors.success }]}>Đăng nhập</Text>
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
  subtitle: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },

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

  actionBtn: { marginTop: 8 },

  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  linkLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  linkText: { fontSize: FontSize.sm, fontWeight: '700' },
});
