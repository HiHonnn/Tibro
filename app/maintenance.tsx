// =========================================================
// app/maintenance.tsx
// Màn hình bảo trì — chặn user sử dụng app
// =========================================================

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, BackHandler, StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../styles/colors';
import { supabase } from '../services/supabaseConfig';

export default function MaintenanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const message = Array.isArray(params.message) ? params.message[0] : params.message;
  const estimatedTime = Array.isArray(params.estimatedTime) ? params.estimatedTime[0] : params.estimatedTime;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 12 }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => backHandler.remove();
  }, [fadeAnim, pulseAnim, scaleAnim]);

  const handleRetry = async () => {
    setChecking(true);
    try {
      const { data: config } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'maintenance')
        .single();

      if (!config?.value?.enabled) {
        // Bảo trì đã tắt → vào app bình thường
        router.replace('/');
      }
    } catch {
      // Nếu lỗi, thử vào app
      router.replace('/');
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Animated Icon */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.iconCircle}>
            <Feather name="tool" size={48} color="#F59E0B" />
          </View>
        </Animated.View>

        {/* Title */}
        <Text style={styles.title}>Đang bảo trì</Text>

        {/* Message */}
        <View style={styles.messageCard}>
          <Feather name="alert-circle" size={18} color="#F59E0B" style={{ marginRight: 10, marginTop: 2 }} />
          <Text style={styles.messageText}>
            {message || 'Hệ thống đang được bảo trì. Vui lòng quay lại sau.'}
          </Text>
        </View>

        {/* Estimated time */}
        {estimatedTime ? (
          <View style={styles.timeCard}>
            <Feather name="clock" size={16} color={Colors.primary} />
            <Text style={styles.timeText}>Thời gian ước tính: {estimatedTime}</Text>
          </View>
        ) : null}

        {/* Info */}
        <Text style={styles.infoText}>
          Chúng tôi đang nâng cấp hệ thống để mang đến trải nghiệm tốt hơn.{'\n'}
          Xin lỗi vì sự bất tiện này! 🙏
        </Text>

        {/* Retry button */}
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} disabled={checking} activeOpacity={0.8}>
          {checking ? (
            <ActivityIndicator color="#F59E0B" size="small" />
          ) : (
            <>
              <Feather name="refresh-cw" size={18} color="#F59E0B" />
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.hintText}>
          Hoặc đóng app và mở lại sau
        </Text>
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F59E0B',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  messageCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.15)',
  },
  messageText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    fontWeight: '500',
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 24,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  retryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  hintText: {
    marginTop: 12,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
