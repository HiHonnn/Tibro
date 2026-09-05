// =========================================================
// components/ReactionAvatars.tsx
// Hiển thị các avatar xếp chồng của người đã react moment
// Chỉ dùng khi xem moment của chính mình
// =========================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ReactionWithUser } from '../services/momentReactionService';

const MAX_DISPLAY = 4;   // Tối đa avatar hiển thị
const AVATAR_SIZE = 36;
const OVERLAP = 14;      // Số pixel chồng lên nhau

interface ReactionAvatarsProps {
  reactions: ReactionWithUser[];
  onPress: () => void;
}

export default function ReactionAvatars({ reactions, onPress }: ReactionAvatarsProps) {
  if (reactions.length === 0) {
    return (
      <TouchableOpacity style={styles.emptyBadge} onPress={onPress} activeOpacity={0.7}>
        <Text style={styles.emptyText}>Chưa có reaction</Text>
      </TouchableOpacity>
    );
  }

  // Filter để mỗi người chỉ xuất hiện 1 lần trong danh sách avatar
  const uniqueReactions = reactions.filter((r, index, self) =>
    index === self.findIndex((t) => t.user_id === r.user_id)
  );

  const displayed = uniqueReactions.slice(0, MAX_DISPLAY);
  const overflow = uniqueReactions.length - displayed.length;
  // Width = avatar đầu tiên + (N-1) * (AVATAR_SIZE - OVERLAP) + overflow badge nếu có
  const rowWidth = AVATAR_SIZE + (displayed.length - 1) * (AVATAR_SIZE - OVERLAP)
    + (overflow > 0 ? AVATAR_SIZE - OVERLAP : 0);

  return (
    <TouchableOpacity
      style={[styles.container, { width: rowWidth }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {displayed.map((r, idx) => (
        <View
          key={r.id}
          style={[
            styles.avatarRing,
            { position: 'absolute', left: idx * (AVATAR_SIZE - OVERLAP), zIndex: MAX_DISPLAY - idx },
          ]}
        >
          {r.user?.avatar ? (
            <Image source={{ uri: r.user.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initial}>{(r.user?.name || '?')[0].toUpperCase()}</Text>
            </View>
          )}
        </View>
      ))}

      {overflow > 0 && (
        <View
          style={[
            styles.avatarRing,
            styles.overflowBadge,
            { position: 'absolute', left: displayed.length * (AVATAR_SIZE - OVERLAP), zIndex: 0 },
          ]}
        >
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: AVATAR_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2.5,
    borderColor: '#1E1E1E',    // Phải khớp màu nền app để viền trắng trông tách bạch
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    backgroundColor: '#3D4066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  overflowBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
  },
});
