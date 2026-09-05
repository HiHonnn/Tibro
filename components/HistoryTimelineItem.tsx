// =========================================================
// components/HistoryTimelineItem.tsx
// Card timeline dọc cho lịch sử di chuyển, style Jagat-like
// =========================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../styles/colors';
import { LocationSession } from '../services/locationHistoryService';

interface Props {
  session: LocationSession;
  isLast: boolean;
  onPress: (session: LocationSession) => void;
}

export default function HistoryTimelineItem({ session, isLast, onPress }: Props) {
  const startTime = new Date(session.startTime).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const durationText =
    session.durationMinutes < 60
      ? `${session.durationMinutes} phút`
      : `${Math.floor(session.durationMinutes / 60)}h ${session.durationMinutes % 60}p`;

  const placeName = session.placeName || `${session.latitude.toFixed(4)}, ${session.longitude.toFixed(4)}`;

  // Static map URL (OpenStreetMap tile)
  const mapPreviewUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${session.latitude},${session.longitude}&zoom=15&size=300x150&maptype=mapnik&markers=${session.latitude},${session.longitude},red-pushpin`;

  return (
    <View style={styles.row}>
      {/* Trục thời gian bên trái */}
      <View style={styles.timelineCol}>
        <Text style={styles.timeText}>{startTime}</Text>
        <View style={styles.dotOuter}>
          <View style={styles.dotInner} />
        </View>
        {!isLast && <View style={styles.line} />}
      </View>

      {/* Card bên phải */}
      <TouchableOpacity style={styles.card} onPress={() => onPress(session)} activeOpacity={0.7}>
        {/* Map Preview */}
        <Image source={{ uri: mapPreviewUrl }} style={styles.mapPreview} resizeMode="cover" />

        {/* Info */}
        <View style={styles.cardContent}>
          <View style={styles.placeRow}>
            <Feather name="map-pin" size={14} color={Colors.primary} />
            <Text style={styles.placeName} numberOfLines={1}>{placeName}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{durationText}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="navigation" size={12} color={Colors.textMuted} />
              <Text style={styles.metaText}>{session.points.length} điểm</Text>
            </View>
          </View>

          {/* Moments */}
          {session.moments && session.moments.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.momentsRow}>
              {session.moments.map(m => (
                <Image 
                  key={m.id} 
                  source={{ uri: m.image_url }} 
                  style={styles.momentThumb} 
                  contentFit="cover" 
                  cachePolicy="memory-disk"
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Feather name="chevron-right" size={18} color={Colors.gray400} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    minHeight: 120,
  },
  // Timeline column
  timelineCol: {
    width: 60,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  dotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 4,
  },
  // Card
  card: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    marginBottom: 16,
    marginLeft: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  mapPreview: {
    width: '100%',
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardContent: {
    padding: 12,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  arrowContainer: {
    position: 'absolute',
    right: 12,
    top: 24, // changed from 50%
  },
  momentsRow: {
    marginTop: 12,
    flexDirection: 'row',
  },
  momentThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});
