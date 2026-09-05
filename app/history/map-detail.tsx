// =========================================================
// app/history/map-detail.tsx
// Màn hình bản đồ chi tiết: hiển thị route polyline của session
// =========================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform , TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import MapView, { Polyline, Marker } from '../../components/PlatformMap';
import { Colors } from '../../styles/colors';

type PointData = {
  lat: number;
  lng: number;
  time: string;
};

export default function HistoryMapDetailScreen() {
  const router = useRouter();
  const { points: pointsStr, placeName, duration } = useLocalSearchParams<{
    points: string;
    placeName: string;
    duration: string;
  }>();

  const points: PointData[] = useMemo(() => {
    try {
      const parsed = JSON.parse(pointsStr || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((point): point is PointData => (
        point
        && Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90
        && Number.isFinite(point.lng) && point.lng >= -180 && point.lng <= 180
        && typeof point.time === 'string' && !Number.isNaN(new Date(point.time).getTime())
      ));
    } catch {
      return [];
    }
  }, [pointsStr]);

  if (points.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết vị trí</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Không có dữ liệu bản đồ</Text>
        </View>
      </SafeAreaView>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];

  // Tính khoảng cách tổng
  const totalDistanceM = points.reduce((acc, p, i) => {
    if (i === 0) return 0;
    const prev = points[i - 1];
    return acc + haversineM(prev.lat, prev.lng, p.lat, p.lng);
  }, 0);

  const distanceStr =
    totalDistanceM < 1000
      ? `${Math.round(totalDistanceM)} m`
      : `${(totalDistanceM / 1000).toFixed(1)} km`;

  // Region trung bình
  const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;

  const latDelta = Math.max(
    0.005,
    (Math.max(...points.map(p => p.lat)) - Math.min(...points.map(p => p.lat))) * 1.5
  );
  const lngDelta = Math.max(
    0.005,
    (Math.max(...points.map(p => p.lng)) - Math.min(...points.map(p => p.lng))) * 1.5
  );

  const startTime = new Date(first.time).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = new Date(last.time).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {placeName || 'Chi tiết vị trí'}
          </Text>
          <Text style={styles.headerSub}>
            {startTime} → {endTime}
          </Text>
        </View>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: avgLat,
          longitude: avgLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
      >
        {/* Polyline */}
        <Polyline
          coordinates={points.map(p => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor={Colors.primary}
          strokeWidth={4}
        />

        {/* Start Marker */}
        <Marker
          coordinate={{ latitude: first.lat, longitude: first.lng }}
          pinColor="#10B981"
          title="Bắt đầu"
          description={startTime}
        />

        {/* End Marker */}
        {points.length > 1 && (
          <Marker
            coordinate={{ latitude: last.lat, longitude: last.lng }}
            pinColor="#EF4444"
            title="Kết thúc"
            description={endTime}
          />
        )}
      </MapView>

      {/* Info Bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Feather name="clock" size={16} color={Colors.primary} />
          <Text style={styles.infoLabel}>{duration || '—'} phút</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoItem}>
          <Feather name="map" size={16} color={Colors.primary} />
          <Text style={styles.infoLabel}>{distanceStr}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoItem}>
          <Feather name="navigation" size={16} color={Colors.primary} />
          <Text style={styles.infoLabel}>{points.length} điểm</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---- Haversine (mét) ----
const haversineM = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  backBtn: { marginRight: 8, padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  map: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  // Info Bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  infoDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.gray200,
  },
});
