// =========================================================
// components/BumpModal.tsx
// Modal hiển thị khi 2 người bạn đang ở rất gần nhau (<50m)
// Cho phép cả 2 bấm "Bump!" để cộng điểm thân mật
// =========================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Modal, Image, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../styles/colors';
import { performBump, getIntimacyLevel } from '../services/intimacyService';

interface BumpModalProps {
  visible: boolean;
  friendId: string;
  friendName: string;
  friendAvatar?: string;
  currentScore: number;
  onClose: () => void;
  onBumped: (newScore: number) => void;
}

export default function BumpModal({
  visible, friendId, friendName, friendAvatar,
  currentScore, onClose, onBumped,
}: BumpModalProps) {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'success' | 'already_bumped'>('idle');
  const [newScore, setNewScore] = useState(currentScore);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStatus('idle');
      setNewScore(currentScore);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      // Pulse animation cho nút Bump
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      pulseAnim.setValue(1);
      confettiAnim.setValue(0);
    }
  }, [confettiAnim, currentScore, opacityAnim, pulseAnim, scaleAnim, visible]);

  const handleBump = async () => {
    if (status !== 'idle') return;
    setStatus('waiting');

    try {
      const result = await performBump(friendId);

      if (!result.success) {
        setStatus('already_bumped');
        return;
      }

      setNewScore(result.newScore);

      setStatus('success');
      onBumped(result.newScore);

      // Confetti animation
      Animated.timing(confettiAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();

    } catch (e) {
      console.error('[BumpModal] handleBump error:', e);
      setStatus('idle');
      Alert.alert('Không thể Bump', 'Hãy chắc rằng cả hai đang chia sẻ vị trí và ở cách nhau không quá 50 mét.');
    }
  };

  const level = getIntimacyLevel(newScore);
  const initial = friendName.charAt(0).toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Header gradient */}
          <LinearGradient
            colors={['#1A1F36', '#0F1428']}
            style={styles.header}
          >
            {/* Close */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Icon proximity */}
            <View style={styles.proximityIcon}>
              <Feather name="zap" size={18} color="#FBBF24" />
            </View>
            <Text style={styles.nearbyText}>Đang ở gần nhau!</Text>

            {/* Avatars */}
            <View style={styles.avatarsRow}>
              {/* Me */}
              <View style={[styles.avatarWrap, styles.meAvatarWrap]}>
                <Text style={styles.meLabel}>Bạn</Text>
              </View>

              {/* Spark */}
              <View style={styles.sparkContainer}>
                <Text style={styles.sparkEmoji}>⚡</Text>
              </View>

              {/* Friend */}
              <View style={styles.avatarWrap}>
                {friendAvatar ? (
                  <Image source={{ uri: friendAvatar }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.friendName}>{friendName}</Text>
          </LinearGradient>

          {/* Body */}
          <View style={styles.body}>
            {/* Intimacy level badge */}
            <View style={[styles.levelBadge, { backgroundColor: level.glowColor }]}>
              <Text style={styles.levelEmoji}>{level.emoji}</Text>
              <Text style={[styles.levelLabel, { color: level.color }]}>{level.label}</Text>
              <Text style={styles.levelScore}>{newScore} điểm</Text>
            </View>

            {/* Content based on status */}
            {status === 'idle' && (
              <>
                <Text style={styles.desc}>
                  Bạn và <Text style={{ color: Colors.primary, fontWeight: '700' }}>{friendName}</Text> đang ở rất gần nhau!{'\n'}
                  Cùng bấm <Text style={{ color: '#FBBF24', fontWeight: '700' }}>Bump!</Text> để nhận +50 điểm thân mật 🎉
                </Text>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity style={styles.bumpBtn} onPress={handleBump} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#FBBF24', '#F59E0B', '#D97706']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.bumpBtnGradient}
                    >
                      <Text style={styles.bumpBtnEmoji}>⚡</Text>
                      <Text style={styles.bumpBtnText}>Bump!</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

            {status === 'waiting' && (
              <View style={styles.statusBox}>
                <Text style={styles.statusEmoji}>⏳</Text>
                <Text style={styles.statusText}>Đang ghi nhận...</Text>
              </View>
            )}

            {status === 'success' && (
              <View style={styles.statusBox}>
                <Text style={styles.statusEmoji}>🎉</Text>
                <Text style={styles.successText}>+50 điểm thân mật!</Text>
                <Text style={styles.successSub}>Tình bạn của bạn với {friendName} đang ngày càng gắn kết</Text>
              </View>
            )}

            {status === 'already_bumped' && (
              <View style={styles.statusBox}>
                <Text style={styles.statusEmoji}>😅</Text>
                <Text style={styles.statusText}>Bạn đã Bump với {friendName} hôm nay rồi!</Text>
                <Text style={styles.statusSub}>Quay lại vào ngày mai để nhận thêm điểm nhé.</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.cardBg,
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proximityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251,191,36,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  nearbyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FBBF24',
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: 'rgba(99,102,241,0.5)',
    overflow: 'hidden',
  },
  meAvatarWrap: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(99,102,241,0.6)',
  },
  meLabel: { fontSize: 13, fontWeight: '700', color: '#818CF8' },
  avatarImg: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: {
    backgroundColor: 'rgba(52,211,153,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: '#34D399' },
  sparkContainer: { alignItems: 'center' },
  sparkEmoji: { fontSize: 28 },
  friendName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },

  body: {
    padding: 20,
    alignItems: 'center',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  levelEmoji: { fontSize: 20 },
  levelLabel: { fontSize: 14, fontWeight: '700' },
  levelScore: { fontSize: 12, color: Colors.textMuted },

  desc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  bumpBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  bumpBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 20,
  },
  bumpBtnEmoji: { fontSize: 20 },
  bumpBtnText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1200',
    letterSpacing: 0.5,
  },

  statusBox: { alignItems: 'center', gap: 8, paddingVertical: 10 },
  statusEmoji: { fontSize: 40, marginBottom: 4 },
  statusText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  statusSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  successText: { fontSize: 18, fontWeight: '900', color: '#FBBF24' },
  successSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
