// =========================================================
// app/banned.tsx
// Màn hình hiển thị khi tài khoản bị ban
// Cho phép khiếu nại qua email admin
// =========================================================

import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Linking, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabaseConfig';
import { Colors } from '../styles/colors';

const ADMIN_EMAIL = 'hoangnguyen6533@gmail.com';

export default function BannedScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12 }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const handleSendAppeal = () => {
    const subject = encodeURIComponent('Khiếu nại tài khoản bị ban - Bump App');
    const body = encodeURIComponent(
      'Xin chào,\n\n' +
      'Tôi muốn khiếu nại việc tài khoản của tôi bị ban.\n\n' +
      'Lý do khiếu nại:\n[Vui lòng mô tả lý do bạn cho rằng việc ban là sai]\n\n' +
      'Thông tin tài khoản:\n- Email: \n- Tên người dùng: \n\n' +
      'Trân trọng.'
    );
    Linking.openURL(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Feather name="shield-off" size={48} color="#EF4444" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Tài khoản đã bị khóa</Text>
        <Text style={styles.subtitle}>
          Tài khoản của bạn đã bị ban do vi phạm quy tắc cộng đồng. 
          Nếu bạn cho rằng đây là một sai lầm, vui lòng liên hệ với quản trị viên để khiếu nại.
        </Text>

        {/* Admin Contact Card */}
        <View style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <Feather name="mail" size={18} color={Colors.primary} />
            <Text style={styles.contactTitle}>Liên hệ quản trị viên</Text>
          </View>
          <TouchableOpacity
            style={styles.emailRow}
            onPress={() => Linking.openURL(`mailto:${ADMIN_EMAIL}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.emailText}>{ADMIN_EMAIL}</Text>
            <Feather name="external-link" size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.appealBtn} onPress={handleSendAppeal} activeOpacity={0.8}>
          <Feather name="send" size={18} color="#fff" />
          <Text style={styles.appealBtnText}>Gửi email khiếu nại</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={16} color={Colors.textMuted} />
          <Text style={styles.logoutBtnText}>Đăng xuất</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  contactCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emailText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  appealBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  appealBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
