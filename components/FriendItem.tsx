// =========================================================
// components/FriendItem.tsx
// Hiển thị trạng thái bạn bè, avatar, tên, status online
// + "Last seen" giống Messenger
// =========================================================

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UserProfile } from '../services/friendService';
import { Colors } from '../styles/colors';
import IntimacyBadge from './IntimacyBadge';

interface FriendItemProps {
  user: UserProfile;
  subText?: string;
  onPress?: () => void;
  rightAction?: React.ReactNode;
  isUnread?: boolean;
  intimacyScore?: number;  // điểm thân mật
}

// ---- Format "last seen" giống Messenger ----
const formatLastSeen = (onlineAt?: string): string => {
  if (!onlineAt) return 'Chưa hoạt động';
  const timestamp = new Date(onlineAt).getTime();
  if (!Number.isFinite(timestamp)) return 'Chưa hoạt động';

  // Chặn số âm nếu đồng hồ hai thiết bị lệch nhau một ít.
  const diff = Math.max(0, Date.now() - timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Đang hoạt động';
  if (mins < 60) return `Hoạt động ${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hoạt động ${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `Hoạt động ${days} ngày trước`;
};

const isRecentlyOnline = (onlineAt?: string): boolean => {
  if (!onlineAt) return false;
  return Math.max(0, Date.now() - new Date(onlineAt).getTime()) < 2 * 60 * 1000;
};

export default function FriendItem({ user, subText, onPress, rightAction, isUnread, intimacyScore }: FriendItemProps) {
  // Logic check online: online_at trong vòng 2 phút (do ping 1 phút/lần)
  const isOnline = isRecentlyOnline(user.online_at);

  const lastSeenText = formatLastSeen(user.online_at);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {user.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
        <View style={[styles.onlineBadge, { backgroundColor: isOnline ? '#4CAF50' : Colors.gray400 }]} />
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isUnread && styles.textUnread]} numberOfLines={1}>
            {user.name}
          </Text>
          {intimacyScore !== undefined && (
            <IntimacyBadge score={intimacyScore} size="sm" />
          )}
        </View>
        <Text style={[styles.subText, isUnread && styles.textUnread]} numberOfLines={1}>
          {subText || (isOnline ? 'Đang hoạt động' : lastSeenText)}
        </Text>
      </View>

      {rightAction && <View style={styles.actionContainer}>{rightAction}</View>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Colors.cardBg,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: Colors.cardBg,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
    flexWrap: 'nowrap',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  subText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  textUnread: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  actionContainer: {
    marginLeft: 12,
  },
});
