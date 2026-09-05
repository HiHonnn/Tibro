// =========================================================
// components/EmojiReaction.tsx
// Hiệu ứng emoji bung nổ trên Moment Viewer
// Dải emoji nằm trong footer, particles bay lên trên
// =========================================================

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Animated, Dimensions, TouchableOpacity, Text } from 'react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const EMOJIS = ['🔥', '😂', '😍', '❤️', '👏'];
const PARTICLE_COUNT = 8;

interface FloatingEmoji {
  id: number;
  emoji: string;
  anim: Animated.Value;
  x: number;
  sway: number;
  scale: number;
}

interface EmojiReactionProps {
  onReaction?: (emoji: string) => void;
}

export default function EmojiReaction({ onReaction }: EmojiReactionProps) {
  const [particles, setParticles] = useState<FloatingEmoji[]>([]);

  const triggerReaction = useCallback((emoji: string) => {
    // Gọi callback để gửi reaction lên server
    onReaction?.(emoji);

    const newParticles: FloatingEmoji[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const anim = new Animated.Value(0);
      const particle: FloatingEmoji = {
        id: Date.now() + i,
        emoji,
        anim,
        x: SCREEN_WIDTH * 0.1 + Math.random() * SCREEN_WIDTH * 0.8,
        sway: (Math.random() - 0.5) * 80,
        scale: 0.6 + Math.random() * 0.8,
      };
      newParticles.push(particle);

      setTimeout(() => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500 + Math.random() * 800,
          useNativeDriver: true,
        }).start(() => {
          setParticles(prev => prev.filter(p => p.id !== particle.id));
        });
      }, i * 80);
    }

    setParticles(prev => [...prev, ...newParticles]);
  }, [onReaction]);

  return (
    <>
      {/* Floating Particles — absolute overlay, chỉ chứa emoji bay */}
      {particles.length > 0 && (
        <View style={styles.particleOverlay} pointerEvents="none">
          {particles.map(p => {
            const translateY = p.anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -SCREEN_HEIGHT * 0.5],
            });
            const translateX = p.anim.interpolate({
              inputRange: [0, 0.3, 0.7, 1],
              outputRange: [0, p.sway * 0.5, p.sway, p.sway * 0.8],
            });
            const opacity = p.anim.interpolate({
              inputRange: [0, 0.2, 0.7, 1],
              outputRange: [0, 1, 0.8, 0],
            });
            const scale = p.anim.interpolate({
              inputRange: [0, 0.15, 0.5, 1],
              outputRange: [0, p.scale * 1.3, p.scale, p.scale * 0.5],
            });

            return (
              <Animated.Text
                key={p.id}
                style={[
                  styles.particle,
                  {
                    left: p.x,
                    transform: [{ translateY }, { translateX }, { scale }],
                    opacity,
                  },
                ]}
              >
                {p.emoji}
              </Animated.Text>
            );
          })}
        </View>
      )}

      {/* Emoji Tray — inline, không phải absolute */}
      <View style={styles.emojiTray}>
        {EMOJIS.map(emoji => (
          <TouchableOpacity
            key={emoji}
            onPress={() => triggerReaction(emoji)}
            style={styles.emojiBtn}
            activeOpacity={0.6}
          >
            <Text style={styles.emojiBtnText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  particleOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    pointerEvents: 'none',
  },
  emojiTray: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnText: {
    fontSize: 20,
  },
  particle: {
    position: 'absolute',
    bottom: 120,
    fontSize: 36,
  },
});
