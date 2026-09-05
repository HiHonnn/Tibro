import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing, 
  interpolate 
} from 'react-native-reanimated';

import { Colors } from '../styles/colors';
import { useLocation } from '../hooks/useLocation';
import { supabase } from '../services/supabaseConfig';
import { findNearbyStrangers, NearbyUser } from '../services/nearbyService';
import { sendFriendRequest } from '../services/friendService';

const { width } = Dimensions.get('window');

export default function RadarScreen() {
  const router = useRouter();
  const { location, errorMsg, retryLocation } = useLocation();
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [isScanning, setIsScanning] = useState(true);

  // Animation values for the radar ripples
  const pulse = useSharedValue(0);

  useEffect(() => {
    // Start ripple animation
    pulse.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.ease) }),
      -1, // Infinite
      false
    );

    // Fetch my profile
    const fetchMe = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.from('users').select('avatar').eq('id', session.user.id).single();
        if (data?.avatar) setMyAvatar(data.avatar);
      }
    };
    fetchMe();
  }, [pulse]);

  // Polling for nearby users every 10 seconds
  useEffect(() => {
    if (!location) return;

    const scan = async (showLoading = false) => {
      if (showLoading) setIsScanning(true);
      try {
        const users = await findNearbyStrangers(
          location.coords.latitude,
          location.coords.longitude,
          20 // 20 mét
        );
        setNearbyUsers(users);
      } catch (e) {
        console.error('Scan error:', e);
      } finally {
        if (showLoading) setIsScanning(false);
      }
    };

    void scan(true); // Scan ngay lần đầu
    const interval = setInterval(() => { void scan(); }, 10000); // 10s quét 1 lần

    return () => clearInterval(interval);
  }, [location]);

  // Styles cho 3 vòng sóng âm
  const ring1Style = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pulse.value, [0, 1], [0.8, 0]),
      transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.5]) }],
    };
  });
  const ring2Style = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pulse.value, [0, 1], [0.5, 0]),
      transform: [{ scale: interpolate(pulse.value, [0, 1], [1.5, 3.5]) }],
    };
  });
  const ring3Style = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pulse.value, [0, 1], [0.2, 0]),
      transform: [{ scale: interpolate(pulse.value, [0, 1], [2, 5]) }],
    };
  });

  const handleAddFriend = (user: NearbyUser) => {
    Alert.alert(
      'Kết nối bạn bè',
      `Bạn muốn gửi lời mời kết bạn đến ${user.user?.name}? (Khoảng cách: ~${user.distanceMeters}m)`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Gửi', 
          onPress: async () => {
            try {
              await sendFriendRequest(user.user_id);
              Alert.alert('Thành công', 'Đã gửi lời mời kết bạn!');
              // Xóa người này khỏi danh sách đang quét để tránh bấm nhiều lần
              setNearbyUsers(prev => prev.filter(u => u.user_id !== user.user_id));
            } catch {
              Alert.alert('Lỗi', 'Không thể gửi lời mời lúc này.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Radar Tìm Bạn</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Radar Area */}
      <View style={styles.radarContainer}>
        {/* Vòng sóng âm */}
        <Animated.View style={[styles.ring, styles.ringCore, ring3Style]} />
        <Animated.View style={[styles.ring, styles.ringCore, ring2Style]} />
        <Animated.View style={[styles.ring, styles.ringCore, ring1Style]} />

        {/* Center Avatar (You) */}
        <View style={styles.centerAvatarContainer}>
          {myAvatar ? (
            <Image source={{ uri: myAvatar }} style={styles.centerAvatar} />
          ) : (
            <View style={[styles.centerAvatar, { backgroundColor: Colors.primary }]} />
          )}
          <View style={styles.centerDot} />
        </View>

        {/* Nearby Users Avatars */}
        {nearbyUsers.map((u, index) => {
          // Tính toán vị trí ngẫu nhiên xung quanh trung tâm (dựa trên index để không đè nhau)
          const angle = (index * (360 / Math.max(nearbyUsers.length, 1))) * (Math.PI / 180);
          // Khoảng cách trên màn hình tỉ lệ thuận với distanceMeters (tối đa 20m)
          const maxRadius = width / 2 - 40;
          const radius = Math.max(80, (u.distanceMeters / 20) * maxRadius); 
          
          const posX = Math.cos(angle) * radius;
          const posY = Math.sin(angle) * radius;

          return (
            <TouchableOpacity 
              key={u.user_id} 
              style={[styles.strangerContainer, { 
                transform: [{ translateX: posX }, { translateY: posY }]
              }]}
              onPress={() => handleAddFriend(u)}
            >
              <View style={styles.strangerAvatarWrapper}>
                {u.user?.avatar ? (
                  <Image source={{ uri: u.user.avatar }} style={styles.strangerAvatar} />
                ) : (
                  <View style={[styles.strangerAvatar, { backgroundColor: Colors.success }]} />
                )}
              </View>
              <View style={styles.strangerInfo}>
                <Text style={styles.strangerName} numberOfLines={1}>{u.user?.name}</Text>
                <Text style={styles.strangerDistance}>{u.distanceMeters}m</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom Status */}
      <View style={styles.bottomStatus}>
        {errorMsg ? (
          <View style={styles.errorStatus}>
            <Text style={styles.statusText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryLocation}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : !location ? (
          <Text style={styles.statusText}>Đang lấy vị trí của bạn...</Text>
        ) : isScanning ? (
          <Text style={styles.statusText}>Đang dò tìm xung quanh...</Text>
        ) : nearbyUsers.length > 0 ? (
          <Text style={styles.statusTextSuccess}>Phát hiện {nearbyUsers.length} người ở gần bạn!</Text>
        ) : (
          <Text style={styles.statusText}>Chưa tìm thấy người dùng nào trong phạm vi 20 mét.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  errorStatus: { alignItems: 'center', gap: 10 },
  retryButton: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: Colors.white, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 10,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  radarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 999,
  },
  ringCore: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  centerAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  centerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  centerDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#0B0F1A',
    bottom: 0,
    right: 0,
  },
  strangerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  strangerAvatarWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
  },
  strangerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  strangerInfo: {
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  strangerName: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 80,
  },
  strangerDistance: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: 'bold',
  },
  bottomStatus: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 14,
    letterSpacing: 1,
  },
  statusTextSuccess: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});
