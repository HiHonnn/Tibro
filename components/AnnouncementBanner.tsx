// =========================================================
// components/AnnouncementBanner.tsx
// Banner hiển thị thông báo hệ thống từ Admin
// =========================================================

import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAnnouncements, SystemAnnouncement } from '../services/announcementService';
import { Colors } from '../styles/colors';

const TYPE_CONFIG: Record<string, { icon: string; color: string; emoji: string }> = {
  info:    { icon: 'info',          color: '#6366F1', emoji: 'ℹ️' },
  warning: { icon: 'alert-triangle', color: '#F59E0B', emoji: '⚠️' },
  update:  { icon: 'refresh-cw',    color: '#3B82F6', emoji: '🔄' },
  event:   { icon: 'gift',          color: '#10B981', emoji: '🎉' },
};

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const loadAnnouncements = useCallback(async () => {
    try {
      const data = await getAnnouncements();
      setAnnouncements(data);
      if (data.length > 0) {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 120,
        }).start();
      }
    } catch {
      // Không hiển thị lỗi — silent fail
    }
  }, [slideAnim]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const dismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const visible = announcements.filter(a => !dismissed.has(a.id));
  const latest = visible[0];

  if (!latest) return null;

  const config = TYPE_CONFIG[latest.type] || TYPE_CONFIG.info;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }], borderLeftColor: config.color }]}>
        <TouchableOpacity
          style={styles.bannerContent}
          onPress={() => visible.length > 1 ? setShowAll(true) : null}
          activeOpacity={0.8}
        >
          <Text style={styles.bannerEmoji}>{config.emoji}</Text>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle} numberOfLines={1}>{latest.title}</Text>
            <Text style={styles.bannerMessage} numberOfLines={1}>{latest.message}</Text>
          </View>
          {visible.length > 1 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{visible.length}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => dismiss(latest.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      {/* Modal xem tất cả thông báo */}
      <Modal visible={showAll} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📢 Thông báo hệ thống</Text>
              <TouchableOpacity onPress={() => setShowAll(false)}>
                <Feather name="x" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={visible}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
                return (
                  <View style={[styles.card, { borderLeftColor: cfg.color }]}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardEmoji}>{cfg.emoji}</Text>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <TouchableOpacity onPress={() => dismiss(item.id)}>
                        <Feather name="x" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.cardMessage}>{item.message}</Text>
                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Không có thông báo mới</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderLeftWidth: 4,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  bannerEmoji: {
    fontSize: 20,
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  bannerMessage: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  badgeCount: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCountText: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: '800',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.black,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  cardEmoji: { fontSize: 16 },
  cardTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  cardMessage: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  cardDate: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
