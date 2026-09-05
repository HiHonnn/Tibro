// =========================================================
// components/AuthContainer.tsx
// Wrapper container cho các màn hình xác thực.
// Bao gồm: gradient background, safe area, keyboard avoiding
// =========================================================

import React from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../styles/colors';

interface AuthContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  innerStyle?: ViewStyle;
}

export default function AuthContainer({
  children,
  scrollable = true,
  style,
  innerStyle,
}: AuthContainerProps) {
  return (
    <SafeAreaView style={[styles.safe, style]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scrollable ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.inner, innerStyle]}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.inner, innerStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
});
