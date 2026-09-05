// =========================================================
// components/ReactionListModal.tsx
// Bottom sheet hiển thị danh sách người đã react moment
// =========================================================

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactionWithUser } from '../services/momentReactionService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.55;

interface ReactionListModalProps {
  visible: boolean;
  reactions: ReactionWithUser[];
  onClose: () => void;
}

// Kiểu dữ liệu sau khi group
interface GroupedReaction {
  userId: string;
  user: { name: string; avatar: string | null };
  emojis: string[];
}

export default function ReactionListModal({ visible, reactions, onClose }: ReactionListModalProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  // Xử lý kéo để đóng (PanResponder)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Chỉ bắt đầu kéo thiết bị khi hướng vuốt dọc chiếm ưu thế
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Chỉ vuốt xuống (dy > 0), không cho vuốt lên quá đỉnh sheet (nếu vuốt lên dy âm sẽ bị reset về 0)
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Nếu vuốt xuống quá nửa chiều cao sheet hoặc vuốt nhanh -> đóng
        if (gestureState.dy > SHEET_HEIGHT / 2 || gestureState.vy > 1.5) {
          Animated.timing(slideAnim, {
            toValue: SHEET_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onClose();
          });
        } else {
          // Bật ngược lên
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  // Group reactions: mỗi user 1 dòng, tối đa 3 emoji mới nhất
  const groupedReactions = useMemo(() => {
    const map = new Map<string, GroupedReaction>();
    
    // reactions đã được sort mới nhất xếp trước từ service
    for (const r of reactions) {
      if (!map.has(r.user_id)) {
        map.set(r.user_id, {
          userId: r.user_id,
          user: { name: r.user.name, avatar: r.user.avatar },
          emojis: [r.emoji]
        });
      } else {
        const existing = map.get(r.user_id)!;
        if (existing.emojis.length < 3) {
          existing.emojis.push(r.emoji);
        }
      }
    }
    return Array.from(map.values());
  }, [reactions]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [slideAnim, visible]);

  const renderItem = ({ item }: { item: GroupedReaction }) => (
    <View style={styles.reactionItem}>
      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        {item.user.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>
              {(item.user.name || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Tên */}
      <Text style={styles.userName} numberOfLines={1}>
        {item.user.name || 'Người dùng'}
      </Text>

      {/* Danh sách Emoji react */}
      <View style={styles.emojiRow}>
        {item.emojis.map((emoji, index) => (
          <Text key={index} style={styles.emojiText}>{emoji}</Text>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }]}
        {...panResponder.panHandlers}
      >
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Reactions</Text>
        </View>

        {/* Danh sách */}
        {groupedReactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌙</Text>
            <Text style={styles.emptyText}>Chưa có ai react</Text>
          </View>
        ) : (
          <FlatList
            data={groupedReactions}
            keyExtractor={(item) => item.userId}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#1A1D2E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatarWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarFallback: {
    backgroundColor: '#3D4066',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  userName: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,  // Khoảng cách giữa các emoji
  },
  emojiText: {
    fontSize: 22,
    marginLeft: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '500',
  },
});
