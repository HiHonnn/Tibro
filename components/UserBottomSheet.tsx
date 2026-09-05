// =========================================================
// components/UserBottomSheet.tsx
// Bottom sheet khi click vào marker bạn bè trên bản đồ:
// Avatar, tên, khoảng cách, nút Nhắn tin + Chỉ đường
// =========================================================

import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import { UserLocation } from '../services/locationService';
import { Colors } from '../styles/colors';
import { IntimacyProgress } from './IntimacyBadge';
import ReportModal from './ReportModal';

const SHEET_HEIGHT = 280; // Chiều cao ước tính của bottom sheet

// ---- Haversine formula: tính khoảng cách giữa 2 tọa độ (km) ----
export const haversineDistance = (
  lat1: number, lon1: number, lat2: number, lon2: number
): number => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ---- Ước tính thời gian di chuyển (km/h trung bình) ----
const estimateTime = (km: number): string => {
  if (km < 1) return `${Math.round(km * 1000)} m · ~${Math.ceil(km * 12)} phút đi bộ`;
  if (km < 5) return `${km.toFixed(1)} km · ~${Math.ceil(km * 3)} phút xe máy`;
  return `${km.toFixed(1)} km · ~${Math.ceil(km * 2)} phút ô tô`;
};

interface Props {
  friendLocation: UserLocation;
  myLat: number;
  myLng: number;
  onClose: () => void;
  onChat: () => void;
  onHistory?: () => void;
  onDirections?: () => void;
  intimacyScore?: number;   // điểm thân mật với bạn này
  onBump?: () => void;       // gọi khi nhấn Bump!
  isNearby?: boolean;        // đang ở gần nhau < 50m
  onPop?: (emoji: string) => void;
}

const PopEmojiButton = ({ emoji, onPop }: { emoji: string; onPop?: (emoji: string) => void }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePop = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.5, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
    ]).start();
    Vibration.vibrate(30);
    onPop?.(emoji);
  };

  return (
    <TouchableOpacity style={styles.popBtn} onPress={handlePop} activeOpacity={0.7}>
      <Animated.Text style={[styles.popEmoji, { transform: [{ scale: scaleAnim }] }]}>
        {emoji}
      </Animated.Text>
    </TouchableOpacity>
  );
};

export default function UserBottomSheet({ friendLocation, myLat, myLng, onClose, onChat, onHistory, onDirections, intimacyScore, onBump, isNearby, onPop }: Props) {
  const distance = haversineDistance(myLat, myLng, friendLocation.latitude, friendLocation.longitude);

  const name = friendLocation.user?.name || 'Bạn bè';
  const avatar = friendLocation.user?.avatar;
  const userId = friendLocation.user_id;

  const [showReportModal, setShowReportModal] = useState(false);

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation mở sheet
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  // Vuốt để tắt
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SHEET_HEIGHT / 2 || gestureState.vy > 1.5) {
          closeSheet();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View style={styles.overlay}>
      <Animated.View style={[styles.backdropContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backdrop} onPress={closeSheet} activeOpacity={1} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        {...panResponder.panHandlers}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* User Info */}
        <View style={styles.userRow}>
          <View style={styles.avatarWrapper}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.distanceText}>{estimateTime(distance)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onChat} activeOpacity={0.7}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(46, 125, 50, 0.2)' }]}>
              <Feather name="message-circle" size={20} color="#4CAF50" />
            </View>
            <Text style={styles.actionLabel}>Nhắn tin</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={onDirections} activeOpacity={0.7}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(21, 101, 192, 0.2)' }]}>
              <Feather name="navigation" size={20} color="#42A5F5" />
            </View>
            <Text style={styles.actionLabel}>Chỉ đường</Text>
          </TouchableOpacity>

          {onHistory && (
            <TouchableOpacity style={styles.actionBtn} onPress={onHistory} activeOpacity={0.7}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(124, 58, 237, 0.2)' }]}>
                <Feather name="clock" size={20} color="#A78BFA" />
              </View>
              <Text style={styles.actionLabel}>Lịch sử</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowReportModal(true)} activeOpacity={0.7}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Feather name="alert-triangle" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Báo cáo</Text>
          </TouchableOpacity>
        </View>
        {/* Intimacy Progress */}
        {intimacyScore !== undefined && (
          <IntimacyProgress score={intimacyScore} />
        )}

        {/* Bump Button - chỉ hiện khi đang ở gần nhau */}
        {isNearby && onBump && (
          <View style={styles.bumpContainer}>
            <TouchableOpacity style={styles.bumpBtn} onPress={() => { onBump(); closeSheet(); }} activeOpacity={0.85}>
              <Text style={styles.bumpBtnEmoji}>⚡</Text>
              <Text style={styles.bumpBtnText}>Bump!</Text>
            </TouchableOpacity>
            <Text style={styles.bumpHint}>Bạn đang ở gần nhau — nhận +50 điểm thân mật!</Text>
          </View>
        )}

        {/* Tiêu chí cộng điểm */}
        {intimacyScore !== undefined && (
          <View style={styles.rulesContainer}>
            <Text style={styles.ruleText}>
              ⚡ Bump: +50đ  •  😍 React Moment: +5đ  •  💬 Nhắn tin: +1đ
            </Text>
          </View>
        )}

        {/* Pops - Bắn Emoji */}
        <View style={styles.popsContainer}>
          <Text style={styles.popsTitle}>Bắn Emoji</Text>
          <View style={styles.emojiRow}>
            {['💩', '❤️', '🤡', '🔥', '🎉'].map((emoji) => (
              <PopEmojiButton key={emoji} emoji={emoji} onPop={onPop} />
            ))}
          </View>
        </View>

        {/* Report Modal */}
        <ReportModal
          visible={showReportModal}
          reportedUserId={userId}
          reportedUserName={name}
          onClose={() => setShowReportModal(false)}
        />

      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
    justifyContent: 'flex-end', zIndex: 999,
  },
  backdropContainer: {
    ...StyleSheet.absoluteFill,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 16,
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22, fontWeight: 'bold', color: Colors.primary,
  },
  userInfo: {
    marginLeft: 14, flex: 1,
  },
  userName: {
    fontSize: 18, fontWeight: '800', color: Colors.textPrimary,
  },
  distanceText: {
    fontSize: 13, color: Colors.textSecondary, marginTop: 4,
  },
  actions: {
    flexDirection: 'row', justifyContent: 'space-around',
  },
  actionBtn: {
    alignItems: 'center', gap: 6,
  },
  actionIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12, fontWeight: '600', color: Colors.textSecondary,
  },
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
  },
  avatarMomentWrapper: {
    borderWidth: 3,
    borderColor: '#E1306C',
    padding: 2,
  },
  // Bump button
  bumpContainer: {
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  bumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 20,
  },
  bumpBtnEmoji: { fontSize: 20 },
  bumpBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
  bumpHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  rulesContainer: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  ruleText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  popsContainer: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
  },
  popsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  popBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popEmoji: {
    fontSize: 24,
  },
});
