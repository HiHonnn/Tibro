// =========================================================
// components/MapMarker.tsx
// Premium 3D Avatar Pin — Gradient Ring + Radar Pulse
// =========================================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { Marker } from './PlatformMap';
import { UserLocation } from '../services/locationService';
import { LinearGradient } from 'expo-linear-gradient';

interface MapMarkerProps {
  location: UserLocation;
  isMe?: boolean;
  onPress?: () => void;
}

export default function MapMarker({ location, isMe, onPress }: MapMarkerProps) {
  const coordinate = {
    latitude: location.latitude,
    longitude: location.longitude,
  };

  const name = isMe ? 'Bạn' : (location.user?.name || 'Ai đó');
  const initial = isMe ? 'B' : (location.user?.name ? location.user.name.charAt(0).toUpperCase() : '?');

  // Màu gradient cho viền avatar
  const gradientColors = isMe
    ? ['#818CF8', '#4F46E5', '#3730A3'] as const
    : ['#34D399', '#10B981', '#059669'] as const;

  // === RADAR PULSE animation (chỉ dùng cho marker "Bạn") ===
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isMe) return;

    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const p1 = createPulse(pulse1, 0);
    const p2 = createPulse(pulse2, 800);
    p1.start();
    p2.start();

    return () => { p1.stop(); p2.stop(); };
  }, [isMe, pulse1, pulse2]);

  const pulseScale1 = pulse1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const pulseOpacity1 = pulse1.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.2, 0] });
  const pulseScale2 = pulse2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const pulseOpacity2 = pulse2.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 0.15, 0] });

  return (
    <Marker coordinate={coordinate} onPress={onPress} tracksViewChanges={isMe}>
      <View style={styles.container}>

        {/* === RADAR PULSE RINGS (chỉ cho marker "Bạn") === */}
        {isMe && (
          <>
            <Animated.View style={[
              styles.pulseRing,
              { transform: [{ scale: pulseScale1 }], opacity: pulseOpacity1, borderColor: '#818CF8' }
            ]} />
            <Animated.View style={[
              styles.pulseRing,
              { transform: [{ scale: pulseScale2 }], opacity: pulseOpacity2, borderColor: '#A5B4FC' }
            ]} />
          </>
        )}

        {/* === OUTER GLOW RING === */}
        <View style={[styles.glowRing, isMe ? styles.glowMe : styles.glowFriend]}>

          {/* === GRADIENT BORDER RING === */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientRing}
          >
            {/* === INNER DARK RING === */}
            <View style={styles.innerWhiteRing}>
              {/* === AVATAR === */}
              {location.user?.avatar ? (
                <Image source={{ uri: location.user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, isMe && styles.placeholderMe]}>
                  <Text style={styles.placeholderText}>{initial}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* === PIN TAIL === */}
        <View style={styles.pinTailContainer}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.pinTail}
          />
          <View style={[styles.pinDot, { backgroundColor: isMe ? '#4F46E5' : '#10B981' }]} />
        </View>

        {/* === FLOATING NAME LABEL === */}
        <View style={styles.labelContainer}>
          <View style={[styles.labelBg, isMe && styles.labelBgMe]}>
            <Text style={styles.labelText} numberOfLines={1}>{name}</Text>
          </View>
        </View>

      </View>
    </Marker>
  );
}

const AVATAR_SIZE = 40;
const BORDER_WIDTH = 3;
const GLOW_PADDING = 4;
const RING_SIZE = AVATAR_SIZE + BORDER_WIDTH * 2 + 2;
const GLOW_SIZE = RING_SIZE + GLOW_PADDING * 2;
const PULSE_SIZE = GLOW_SIZE; // pulse ring starts from glow size

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 130,
  },

  // === Radar Pulse (only for "me") ===
  pulseRing: {
    position: 'absolute',
    top: (130 - PULSE_SIZE) / 2 - 20, // center vertically on avatar area
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },

  // === Outer Glow ===
  glowRing: {
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  glowMe: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  glowFriend: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },

  // === Gradient Ring ===
  gradientRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // === Inner dark gap ===
  innerWhiteRing: {
    width: AVATAR_SIZE + 4,
    height: AVATAR_SIZE + 4,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    backgroundColor: '#0D1B2A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // === Avatar ===
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#1E3A50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderMe: {
    backgroundColor: '#2E2B5F',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  // === Pin Tail ===
  pinTailContainer: {
    alignItems: 'center',
    marginTop: -2,
  },
  pinTail: {
    width: 3,
    height: 12,
    borderRadius: 1.5,
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: -1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // === Floating Label ===
  labelContainer: {
    marginTop: 4,
  },
  labelBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  labelBgMe: {
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
