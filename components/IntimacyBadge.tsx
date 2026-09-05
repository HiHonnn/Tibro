// =========================================================
// components/IntimacyBadge.tsx
// Badge nhỏ hiển thị cấp độ tình bạn (🌱🌿🔥👑)
// Có thể dùng trong FriendItem, UserBottomSheet, MapMarker label
// =========================================================
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getIntimacyLevel, IntimacyLevel } from '../services/intimacyService';

interface IntimacyBadgeProps {
  score: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export default function IntimacyBadge({ score, size = 'sm', showLabel = false }: IntimacyBadgeProps) {
  const level: IntimacyLevel = getIntimacyLevel(score);
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: level.glowColor }, isSmall ? styles.badgeSm : styles.badgeMd]}>
      <Text style={isSmall ? styles.emojiSm : styles.emojiMd}>{level.emoji}</Text>
      {showLabel && (
        <Text style={[styles.label, { color: level.color }]}>{level.label}</Text>
      )}
    </View>
  );
}

// ---- Progress bar đến cấp độ tiếp theo ----
interface IntimacyProgressProps {
  score: number;
}

export function IntimacyProgress({ score }: IntimacyProgressProps) {
  const level = getIntimacyLevel(score);
  const nextLevel = level.level < 4
    ? [null, { minScore: 0 }, { minScore: 101 }, { minScore: 501 }, { minScore: 2001 }][level.level + 1]
    : null;

  const range = nextLevel ? nextLevel.minScore - level.minScore : 1;
  const progress = score - level.minScore;
  const percent = nextLevel ? Math.min(100, Math.round((progress / range) * 100)) : 100;
  const pointsLeft = nextLevel ? nextLevel.minScore - score : 0;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <View style={styles.levelRow}>
          <Text style={styles.progressEmoji}>{level.emoji}</Text>
          <Text style={[styles.levelLabel, { color: level.color }]}>{level.label}</Text>
        </View>
        <Text style={styles.scoreText}>{score} điểm</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${percent}%` as any, backgroundColor: level.color }]} />
      </View>

      {nextLevel ? (
        <Text style={styles.progressHint}>Còn {pointsLeft} điểm để lên {['', '', '🌿', '🔥', '👑'][level.level + 1]}</Text>
      ) : (
        <Text style={styles.progressHint}>🏆 Đã đạt cấp độ tối đa!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    gap: 4,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  emojiSm: { fontSize: 12 },
  emojiMd: { fontSize: 18 },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Progress bar
  progressContainer: {
    marginTop: 16,
    paddingHorizontal: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressEmoji: { fontSize: 20 },
  levelLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreText: {
    fontSize: 13,
    color: '#6B7A99',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 11,
    color: '#6B7A99',
    textAlign: 'right',
  },
});
