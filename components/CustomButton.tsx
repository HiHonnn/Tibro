// =========================================================
// components/CustomButton.tsx
// Button tái sử dụng với animation nhẹ (scale + opacity)
// =========================================================

import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../styles/colors';
import { BorderRadius, FontSize } from '../styles/globalStyles';

interface CustomButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  color?: string;          // màu nền button
  textColor?: string;      // màu chữ
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: 'solid' | 'outline' | 'ghost';
}

export default function CustomButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  color = Colors.primary,
  textColor = Colors.white,
  style,
  textStyle,
  variant = 'solid',
}: CustomButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const isDisabled = disabled || loading;

  // Build button style theo variant
  const btnBg: ViewStyle =
    variant === 'solid'
      ? { backgroundColor: color }
      : variant === 'outline'
      ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: color }
      : { backgroundColor: 'transparent' };

  const txtColor =
    variant === 'solid' ? textColor : color;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={[
          styles.button,
          btnBg,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'solid' ? Colors.white : color} size="small" />
        ) : (
          <Text style={[styles.label, { color: txtColor }, textStyle]}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.xl,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.6,
  },
});
