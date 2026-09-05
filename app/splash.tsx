// =========================================================
// app/splash.tsx
// Premium Splash Screen — Animated Tibro Logo + Breath Effect
// =========================================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../styles/colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  // Primary animation values
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;

  // Background decoration animations
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance Animation
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Continuous Breathing Animation for Logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.06,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Background Orb Animations
    const floatOrb = (anim: Animated.Value, toVal: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: toVal, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ])
      );

    floatOrb(orb1Anim, 20, 4000).start();
    floatOrb(orb2Anim, -25, 5000).start();

    // 4. Redirect after animation
    const timer = setTimeout(() => {
      router.replace('/index' as any);
    }, 4000);

    return () => clearTimeout(timer);
  }, [breathAnim, contentFade, logoOpacity, logoScale, orb1Anim, orb2Anim, router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F1A" />

      {/* Deep Indigo Gradient Background */}
      <LinearGradient
        colors={['#0B0F1A', '#0D0E25', '#1E1B4B', '#0B0F1A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative Blurred Orbs */}
      <Animated.View 
        style={[
          styles.orb, 
          styles.orb1, 
          { transform: [{ translateY: orb1Anim }] }
        ]} 
      />
      <Animated.View 
        style={[
          styles.orb, 
          styles.orb2, 
          { transform: [{ translateY: orb2Anim }] }
        ]} 
      />

      {/* Logo Container with Spring & Breathing effects */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: logoOpacity,
            transform: [
              { scale: Animated.multiply(logoScale, breathAnim) }
            ],
          },
        ]}
      >
        <View style={styles.logoShadow} />
        <Image 
          source={require('../assets/images/Logo_tibro_removebg.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Text Content */}
      <Animated.View 
        style={[
          styles.textContainer,
          { opacity: contentFade }
        ]}
      >
        <Text style={styles.appName}>Tibro</Text>
        <Text style={styles.tagline}>Xây dựng cộng đồng quanh bạn</Text>
      </Animated.View>

      {/* Bottom Loading Indicator */}
      <Animated.View style={[styles.footer, { opacity: contentFade }]}>
        <View style={styles.loadingBarContainer}>
          <View style={styles.loadingBarActive} />
        </View>
        <Text style={styles.versionText}>v1.0.0</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  orb1: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: Colors.primary,
    top: -50,
    right: -100,
  },
  orb2: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: '#818CF8',
    bottom: 50,
    left: -80,
  },
  logoWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoShadow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    opacity: 0.2,
  },
  logoImage: {
    width: 160,
    height: 160,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    width: '100%',
  },
  loadingBarContainer: {
    width: 120,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  loadingBarActive: {
    width: '100%', // Could be animated but static full width looks like a branding bar too
    height: '100%',
    backgroundColor: Colors.primary,
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  },
});
