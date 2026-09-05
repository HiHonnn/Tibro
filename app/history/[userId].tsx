// =========================================================
// app/history/[userId].tsx
// Màn hình lịch sử di chuyển của bạn bè (Timeline dọc)
// =========================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../styles/colors';
import {
  getFriendLocationHistory,
  groupLocationSessions,
  LocationSession,
} from '../../services/locationHistoryService';
import { getMomentsByDate } from '../../services/momentService';
import HistoryTimelineItem from '../../components/HistoryTimelineItem';
import EmptyState from '../../components/EmptyState';
import * as Location from 'expo-location';

// ---- Helpers ----
const formatDateLabel = (dateStr: string): string => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hôm nay';
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';

  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
};

const getDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ---- Date filter buttons ----
const DATE_FILTERS = (() => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  return [
    { label: 'Hôm nay', value: getDateStr(today) },
    { label: 'Hôm qua', value: getDateStr(yesterday) },
    { label: formatDateLabel(getDateStr(twoDaysAgo)), value: getDateStr(twoDaysAgo) },
  ];
})();

export default function HistoryScreen() {
  const router = useRouter();
  const { userId, userName, userAvatar } = useLocalSearchParams<{
    userId: string; userName: string; userAvatar: string;
  }>();

  const [sessions, setSessions] = useState<LocationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(DATE_FILTERS[0].value);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [points, dateMoments] = await Promise.all([
        getFriendLocationHistory(userId, selectedDate),
        getMomentsByDate(userId, selectedDate)
      ]);
      const grouped = groupLocationSessions(points);

      // Reverse geocode tên địa điểm cho mỗi session và gắn moments
      const withNames = await Promise.all(
        grouped.map(async (s) => {
          // Gắn moments vào session (mở rộng biên độ thời gian +/- 30 phút vì GPS có thể cập nhật thưa)
          s.moments = dateMoments.filter(m => {
            const mTime = new Date(m.created_at).getTime();
            const sStart = new Date(s.startTime).getTime() - 30 * 60 * 1000;
            const sEnd = new Date(s.endTime).getTime() + 30 * 60 * 1000;
            return mTime >= sStart && mTime <= sEnd;
          });

          try {
            const results = await Location.reverseGeocodeAsync({
              latitude: s.latitude,
              longitude: s.longitude,
            });
            if (results.length > 0) {
              const r = results[0];
              const parts = [r.name, r.street, r.district, r.city].filter(Boolean);
              s.placeName = parts.slice(0, 2).join(', ') || `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`;
            }
          } catch {
            // Silently ignore geocoding fails
          }
          return s;
        })
      );

      setSessions(withNames);
    } catch (e) {
      console.log('Fetch history error:', e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSessionPress = (session: LocationSession) => {
    router.push({
      pathname: '/history/map-detail',
      params: {
        points: JSON.stringify(session.points.map(p => ({
          lat: p.latitude,
          lng: p.longitude,
          time: p.created_at,
        }))),
        placeName: session.placeName || '',
        duration: String(session.durationMinutes),
      },
    } as any);
  };

  const name = userName || 'Bạn bè';
  const avatar = userAvatar;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Text style={styles.headerAvatarText}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{name}</Text>
            <Text style={styles.headerSub}>Lịch sử di chuyển</Text>
          </View>
        </View>
      </View>

      {/* Date Filter */}
      <View style={styles.filterRow}>
        {DATE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, selectedDate === f.value && styles.filterBtnActive]}
            onPress={() => setSelectedDate(f.value)}
          >
            <Text style={[
              styles.filterText,
              selectedDate === f.value && styles.filterTextActive,
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loader}>
          {/* Skeleton shimmer */}
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.skeletonRow}>
              <View style={styles.skeletonTime} />
              <View style={styles.skeletonCard} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <HistoryTimelineItem
              session={item}
              isLast={index === sessions.length - 1}
              onPress={handleSessionPress}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              emoji="📍"
              title="Không có dữ liệu"
              description={`Không tìm thấy lịch sử di chuyển cho ${formatDateLabel(selectedDate).toLowerCase()}.`}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.black },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { marginRight: 8, padding: 4 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerAvatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: Colors.primary, fontWeight: 'bold', fontSize: 18 },
  headerName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  // Filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  // Content
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loader: {
    padding: 16,
  },
  // Skeleton
  skeletonRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  skeletonTime: {
    width: 60,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
    marginTop: 4,
  },
  skeletonCard: {
    flex: 1,
    height: 140,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
