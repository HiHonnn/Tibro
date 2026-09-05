import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Vibration } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface EmojiRainItem {
  id: string;
  emoji: string;
  count: number;
}

interface EmojiRainProps {
  emojis: EmojiRainItem[];
  onComplete: () => void;
}

interface Particle {
  id: string;
  emoji: string;
  x: number;
  anim: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  speed: number;
}

const VIBRATION_PATTERN = [0, 80, 60, 80, 60, 120];

export default function EmojiRain({ emojis, onComplete }: EmojiRainProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  // Track how many active animations are running
  const activeRef = useRef(0);
  // Track which emoji IDs we've already processed
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Track which particles have already started animating
  const animsStartedRef = useRef<Set<string>>(new Set());
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // 1. Nhận emoji mới -> Tạo hạt (particles) -> Lưu vào state để React render ra UI
  useEffect(() => {
    if (emojis.length === 0) return;

    const newItems = emojis.filter(e => !seenIdsRef.current.has(e.id));
    if (newItems.length === 0) return;
    newItems.forEach(e => seenIdsRef.current.add(e.id));

    // Rung & lắc màn hình
    Vibration.vibrate(VIBRATION_PATTERN);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();

    const newParticles: Particle[] = [];
    let counter = Date.now();
    
    // Tính tổng số lượng của đợt này
    const totalCount = newItems.reduce((acc, item) => acc + item.count, 0);
    // Giới hạn TỔNG SỐ HẠT trong 1 lần bay là 150 để không sập app
    const MAX_TOTAL_PARTICLES = 150;
    
    newItems.forEach(item => {
      // Phân bổ tỷ lệ thuận nếu vượt quá MAX_TOTAL_PARTICLES
      let count = item.count;
      if (totalCount > MAX_TOTAL_PARTICLES) {
        count = Math.max(1, Math.floor((item.count / totalCount) * MAX_TOTAL_PARTICLES));
      } else {
        count = Math.min(item.count, MAX_TOTAL_PARTICLES);
      }

      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: `p_${item.id}_${counter++}_${i}`,
          emoji: item.emoji,
          x: Math.random() * SCREEN_W,
          anim: new Animated.Value(0),
          rotate: new Animated.Value(Math.random()),
          scale: new Animated.Value(Math.random() * 0.6 + 0.9),
          speed: Math.random() * 1500 + 1500,
        });
      }
    });

    activeRef.current += newParticles.length;
    setParticles(prev => [...prev, ...newParticles]);
  }, [emojis, shakeAnim]);

  // 2. Sau khi render xong -> Bắt đầu chạy animation cho các hạt mới
  useEffect(() => {
    if (particles.length === 0) return;

    const toAnimate = particles.filter(p => !animsStartedRef.current.has(p.id));
    if (toAnimate.length === 0) return;

    toAnimate.forEach(p => animsStartedRef.current.add(p.id));

    const anims = toAnimate.map((p) =>
      Animated.sequence([
        Animated.delay(Math.random() * 400),
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.speed,
          useNativeDriver: true,
        }),
      ])
    );

    // Chờ thêm 1 chút để đảm bảo UI thread đã hoàn thành việc vẽ elements
    setTimeout(() => {
      Animated.parallel(anims).start(() => {
        const doneIds = new Set(toAnimate.map(p => p.id));
        setParticles(prev => prev.filter(p => !doneIds.has(p.id)));
        activeRef.current -= toAnimate.length;

        if (activeRef.current <= 0) {
          activeRef.current = 0;
          seenIdsRef.current.clear();
          animsStartedRef.current.clear();
          onCompleteRef.current();
        }
      });
    }, 300);
  }, [particles]);

  if (particles.length === 0) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}
      pointerEvents="none"
    >
      {particles.map(p => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [SCREEN_H + 50, -100],
        });
        const rotate = p.rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['-60deg', '60deg'],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.08, 0.75, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.Text
            key={p.id}
            style={[
              styles.emoji,
              {
                left: p.x,
                opacity,
                transform: [{ translateY }, { rotate }, { scale: p.scale }],
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
  },
  emoji: {
    position: 'absolute',
    fontSize: 42,
  },
});
