// =========================================================
// components/NotificationPanel.tsx
// Panel thông báo — gom nhóm theo moment_id (react)
// Cùng 1 moment → 1 dòng dù có nhiều người react
// =========================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, FlatList, Platform, Image, PanResponder
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../styles/colors';
import {
  AppNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService';
import { MomentData } from '../services/momentService';
import { getAnnouncements, SystemAnnouncement } from '../services/announcementService';

interface NotificationPanelProps {
  visible: boolean;
  onClose: () => void;
  onOpenMoment?: (moments: MomentData[], index: number) => void;
}

// ---- Kiểu Group (sau khi gom nhóm) ----
type GroupedNotif = {
  key: string;                    // unique key để dùng làm FlatList key
  type: string;
  moment_id?: string;             // chỉ có với moment_reaction groups
  actors: AppNotification['actor'][];   // danh sách người thực hiện
  emojis: string[];               // các emoji đã react
  latestNotif: AppNotification;   // notification mới nhất trong nhóm
  hasUnread: boolean;
  ids: string[];                  // tất cả notification id trong nhóm
  data: Record<string, any>;
};

// ---- Gom nhóm notifications ----
const groupNotifications = (notifs: AppNotification[]): GroupedNotif[] => {
  const momentGroups: Map<string, AppNotification[]> = new Map();
  const popGroups: Map<string, AppNotification[]> = new Map();
  const singles: AppNotification[] = [];

  for (const n of notifs) {
    if (n.type === 'moment_reaction' && n.data?.moment_id) {
      const key = n.data.moment_id as string;
      if (!momentGroups.has(key)) momentGroups.set(key, []);
      momentGroups.get(key)!.push(n);
    } else if (n.type === 'emoji_pop') {
      // Gom theo actor_id: cùng 1 người gửi → 1 dòng
      const key = n.actor_id;
      if (!popGroups.has(key)) popGroups.set(key, []);
      popGroups.get(key)!.push(n);
    } else {
      singles.push(n);
    }
  }

  const result: GroupedNotif[] = [];

  // 1. Moment reaction groups
  momentGroups.forEach((group, momentId) => {
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seenActors = new Set<string>();
    const uniqueActors: AppNotification['actor'][] = [];
    const uniqueEmojis: string[] = [];
    for (const n of group) {
      if (!seenActors.has(n.actor_id)) {
        seenActors.add(n.actor_id);
        uniqueActors.push(n.actor);
        uniqueEmojis.push(n.data?.emoji || '😍');
      }
    }
    result.push({
      key: `moment_${momentId}`,
      type: 'moment_reaction',
      moment_id: momentId,
      actors: uniqueActors,
      emojis: uniqueEmojis,
      latestNotif: group[0],
      hasUnread: group.some(n => !n.is_read),
      ids: group.map(n => n.id),
      data: group[0].data,
    });
  });

  // 2. Emoji pop groups (gom theo actor)
  popGroups.forEach((group, actorId) => {
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    // Tập hợp tất cả emoji đã gửi (có thể trùng nếu gửi nhiều lần)
    const allEmojis = group.map(n => n.data?.emoji).filter(Boolean);
    result.push({
      key: `pop_${actorId}`,
      type: 'emoji_pop',
      actors: [group[0].actor],
      emojis: allEmojis,
      latestNotif: group[0],
      hasUnread: group.some(n => !n.is_read),
      ids: group.map(n => n.id),
      data: group[0].data,
    });
  });

  // 3. Các loại khác — mỗi cái 1 dòng
  for (const n of singles) {
    result.push({
      key: n.id,
      type: n.type,
      actors: [n.actor],
      emojis: [],
      latestNotif: n,
      hasUnread: !n.is_read,
      ids: [n.id],
      data: n.data,
    });
  }

  result.sort((a, b) =>
    new Date(b.latestNotif.created_at).getTime() -
    new Date(a.latestNotif.created_at).getTime()
  );

  return result;
};

// ---- Format thời gian ----
const formatTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
};

// ---- Stacked avatars (tối đa 3) ----
const StackedAvatars = ({ actors }: { actors: AppNotification['actor'][] }) => {
  const shown = actors.slice(0, 3);
  return (
    <View style={styles.stackedAvatars}>
      {shown.map((actor, i) => {
        const initial = actor?.name?.charAt(0).toUpperCase() || '?';
        return (
          <View
            key={`${actor?.id ?? i}_${i}`}
            style={[styles.stackedAvatar, { zIndex: 10 - i, marginLeft: i === 0 ? 0 : -12 }]}
          >
            {actor?.avatar ? (
              <Image source={{ uri: actor.avatar }} style={styles.stackedAvatarImg} />
            ) : (
              <View style={[styles.stackedAvatarImg, styles.stackedPlaceholder]}>
                <Text style={styles.stackedInitial}>{initial}</Text>
              </View>
            )}
          </View>
        );
      })}
      {actors.length > 3 && (
        <View style={[styles.stackedAvatar, styles.moreCount, { marginLeft: -12 }]}>
          <Text style={styles.moreCountText}>+{actors.length - 3}</Text>
        </View>
      )}
    </View>
  );
};

// ---- Grouped Notification Item ----
const GroupedNotifItem = ({
  group,
  onPress,
}: {
  group: GroupedNotif;
  onPress: (group: GroupedNotif) => void;
}) => {
  const isMomentReact = group.type === 'moment_reaction';

  // Build text
  let mainText = '';
  let subText = '';
  let typeEmoji = '🔔';

  if (isMomentReact) {
    typeEmoji = group.emojis[0] || '😍';
    const firstName = group.actors[0]?.name || 'Ai đó';
    const rest = group.actors.length - 1;
    if (rest === 0) {
      mainText = `${firstName} đã react moment của bạn`;
    } else {
      mainText = `${firstName} và ${rest} người khác đã react moment của bạn`;
    }
    // Hiển thị các emoji đã react
    const emojiSet = [...new Set(group.emojis)].slice(0, 5).join(' ');
    subText = emojiSet + (group.data?.caption ? `  "${group.data.caption}"` : '');
  } else if (group.type === 'emoji_pop') {
    // Hiển thị emoji đầu tiên làm icon chính
    const uniquePopEmojis = [...new Set(group.emojis)];
    typeEmoji = uniquePopEmojis[0] || '🎉';
    const name = group.actors[0]?.name || 'Ai đó';
    mainText = `${name} đã bắn emoji vào bạn`;
    // Gom và hiện tất cả emoji đã gửi
    subText = uniquePopEmojis.join('  ');
  } else if (group.type === 'intimacy_bump') {
    typeEmoji = '⚡';
    mainText = `Bạn đã Bump với ${group.actors[0]?.name || 'ai đó'}!`;
    subText = '+50 điểm thân mật';
  } else if (group.type === 'intimacy_chat') {
    typeEmoji = '💬';
    mainText = `Bạn nhắn tin với ${group.actors[0]?.name || 'ai đó'}`;
    subText = '+1 điểm thân mật';
  }

  return (
    <TouchableOpacity
      style={[styles.notifItem, group.hasUnread && styles.notifItemUnread]}
      onPress={() => onPress(group)}
      activeOpacity={0.75}
    >
      {/* Stacked avatars (moment_reaction) hoặc single avatar */}
      <View style={styles.avatarSection}>
        {isMomentReact ? (
          <View>
            <StackedAvatars actors={group.actors} />
            {/* emoji badge */}
            <View style={styles.emojiBadge}>
              <Text style={styles.emojiBadgeText}>{typeEmoji}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.singleAvatarWrap}>
            {group.actors[0]?.avatar ? (
              <Image source={{ uri: group.actors[0].avatar }} style={styles.singleAvatar} />
            ) : (
              <View style={[styles.singleAvatar, styles.singlePlaceholder]}>
                <Text style={styles.singleInitial}>
                  {group.actors[0]?.name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.emojiBadge}>
              <Text style={styles.emojiBadgeText}>{typeEmoji}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.notifContent}>
        <Text style={[styles.notifText, group.hasUnread && styles.notifTextBold]} numberOfLines={2}>
          {mainText}
        </Text>
        {subText.length > 0 && (
          <Text style={styles.notifSubText} numberOfLines={1}>{subText}</Text>
        )}
        <Text style={styles.notifTime}>{formatTime(group.latestNotif.created_at)}</Text>
      </View>

      {/* Unread dot */}
      {group.hasUnread && <View style={styles.unreadDot} />}

      {/* Arrow → chỉ với moment_reaction */}
      {isMomentReact && (
        <Feather name="chevron-right" size={16} color={Colors.textMuted} style={{ marginLeft: 2 }} />
      )}
    </TouchableOpacity>
  );
};

// ============================================================
// Main Component
// ============================================================
export default function NotificationPanel({ visible, onClose, onOpenMoment }: NotificationPanelProps) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Xử lý kéo để đóng (PanResponder)
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
        if (gestureState.dy > 150 || gestureState.vy > 1.5) {
          Animated.parallel([
            Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => onClose());
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

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [notifData, annData] = await Promise.all([
        getNotifications(60),
        getAnnouncements(),
      ]);
      setNotifications(notifData);
      setAnnouncements(annData);
    } catch (e) {
      console.error('[NotificationPanel] load error:', e);
      setLoadError('Không thể tải thông báo. Vui lòng kiểm tra kết nối.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadNotifications();
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [fadeAnim, loadNotifications, slideAnim, visible]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleGroupPress = async (group: GroupedNotif) => {
    // Mark tất cả trong group đã đọc
    if (group.hasUnread) {
      group.ids.forEach(id => markNotificationRead(id).catch(() => {}));
      setNotifications(prev =>
        prev.map(n => group.ids.includes(n.id) ? { ...n, is_read: true } : n)
      );
    }

    // Navigate đến moment
    if (group.type === 'moment_reaction' && group.data?.moment_id && onOpenMoment) {
      const fakeMoment: MomentData = {
        id: group.data.moment_id,
        user_id: group.data.moment_owner_id || '',
        image_url: group.data.image_url || '',
        latitude: 0,
        longitude: 0,
        caption: group.data.caption,
        created_at: group.latestNotif.created_at,
      };
      onOpenMoment([fakeMoment], 0);
      onClose();
    }
  };

  const grouped = groupNotifications(notifications);
  const unreadCount = grouped.filter(g => g.hasUnread).length;

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

      <Animated.View 
        style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}
        {...panResponder.panHandlers}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Feather name="bell" size={20} color={Colors.primary} />
            <Text style={styles.headerTitle}>Thông báo</Text>
            {unreadCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
                <Text style={styles.markAllText}>Đọc tất cả</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Đang tải...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={styles.emptyText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadNotifications}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🔕</Text>
            <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
            <Text style={styles.emptySubText}>
              Khi bạn bè react Moment hay bạn Bump với ai, sẽ hiện ở đây!
            </Text>
          </View>
        ) : (
          <FlatList
            data={grouped}
            keyExtractor={item => item.key}
            ListHeaderComponent={
              announcements.length > 0 ? (
                <View style={styles.announcementSection}>
                  {announcements.map((a) => {
                    const cfg: Record<string, { emoji: string; color: string }> = {
                      info:    { emoji: 'ℹ️', color: '#6366F1' },
                      warning: { emoji: '⚠️', color: '#F59E0B' },
                      update:  { emoji: '🔄', color: '#3B82F6' },
                      event:   { emoji: '🎉', color: '#10B981' },
                    };
                    const c = cfg[a.type] || cfg.info;
                    return (
                      <View key={a.id} style={[styles.announcementCard, { borderLeftColor: c.color }]}>
                        <View style={styles.announcementHeader}>
                          <Text style={styles.announcementEmoji}>{c.emoji}</Text>
                          <Text style={styles.announcementTitle}>{a.title}</Text>
                        </View>
                        <Text style={styles.announcementMessage}>{a.message}</Text>
                        <Text style={styles.announcementDate}>
                          {(() => { const d = new Date(a.created_at); return `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`; })()}
                        </Text>
                      </View>
                    );
                  })}
                  <View style={styles.announcementDivider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>Thông báo cá nhân</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <GroupedNotifItem group={item} onPress={handleGroupPress} />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const AVATAR_SIZE = 42;
const STACKED_SIZE = 38;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end', zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '75%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 30,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  countBadge: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAllBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 12,
  },
  markAllText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  // List
  listContent: { paddingVertical: 4 },
  notifItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 13,
    gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  notifItemUnread: { backgroundColor: 'rgba(99,102,241,0.06)' },

  // Avatar section
  avatarSection: { position: 'relative' },

  // Stacked avatars (moment_reaction)
  stackedAvatars: { flexDirection: 'row', alignItems: 'center', height: STACKED_SIZE },
  stackedAvatar: {
    width: STACKED_SIZE, height: STACKED_SIZE,
    borderRadius: STACKED_SIZE / 2,
    borderWidth: 2, borderColor: Colors.cardBg,
    overflow: 'hidden',
  },
  stackedAvatarImg: { width: '100%', height: '100%' },
  stackedPlaceholder: {
    backgroundColor: 'rgba(99,102,241,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  stackedInitial: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  moreCount: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  moreCountText: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary },

  // Single avatar (bump/chat)
  singleAvatarWrap: { position: 'relative' },
  singleAvatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  singlePlaceholder: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  singleInitial: { fontSize: 17, fontWeight: '800', color: Colors.primary },

  // Emoji badge chung
  emojiBadge: {
    position: 'absolute', bottom: -5, right: -5,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.cardBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  emojiBadgeText: { fontSize: 12 },

  // Content
  notifContent: { flex: 1 },
  notifText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  notifTextBold: { color: Colors.textPrimary, fontWeight: '600' },
  notifSubText: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  notifTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary,
  },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptySubText: {
    fontSize: 13, color: Colors.textMuted,
    textAlign: 'center', paddingHorizontal: 32, lineHeight: 20,
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Announcements
  announcementSection: { paddingHorizontal: 16, paddingTop: 8 },
  announcementCard: {
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 8,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  announcementEmoji: { fontSize: 16 },
  announcementTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  announcementMessage: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  announcementDate: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },
  announcementDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});
