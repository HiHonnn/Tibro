// =========================================================
// components/CustomInput.tsx
// Input tái sử dụng: bo tròn, focus border, toggle mật khẩu
// =========================================================

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Colors } from '../styles/colors';
import { BorderRadius, FontSize, Spacing } from '../styles/globalStyles';

interface CustomInputProps extends TextInputProps {
  label?: string;
  isPassword?: boolean;
  error?: string;
  containerStyle?: ViewStyle;
  iconLeft?: React.ReactNode;
  accentColor?: string;
}

export default function CustomInput({
  label,
  isPassword = false,
  error,
  containerStyle,
  iconLeft,
  accentColor = Colors.primary,
  ...props
}: CustomInputProps) {
  const [showPass, setShowPass] = useState(false);

  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    props.onFocus?.(undefined as any);
  };

  const handleBlur = () => {
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    props.onBlur?.(undefined as any);
  };

  const animatedBorderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.inputBorder, accentColor],
  });

  const animatedBg = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.inputBg, Colors.cardBg],
  });

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Animated.View
        style={[
          styles.inputRow,
          {
            borderColor: error ? Colors.error : animatedBorderColor,
            backgroundColor: animatedBg,
          },
        ]}
      >
        {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}

        <TextInput
          style={[styles.input, iconLeft ? { paddingLeft: 0 } : null]}
          placeholderTextColor={Colors.placeholder}
          secureTextEntry={isPassword && !showPass}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPass(!showPass)}
            style={styles.eyeBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  iconLeft: {
    paddingLeft: Spacing.md,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: FontSize.base,
    color: Colors.inputText,
    letterSpacing: 0,
  },
  eyeBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  eyeIcon: {
    fontSize: 16,
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
});
