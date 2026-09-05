// =========================================================
// styles/globalStyles.ts
// Các style dùng chung cho toàn bộ ứng dụng Bump
// =========================================================

import { StyleSheet, Dimensions } from 'react-native';
import { Colors } from './colors';

const { width, height } = Dimensions.get('window');

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const globalStyles = StyleSheet.create({
  // ---- Layout ----
  flex1: { flex: 1 },
  flexRow: { flexDirection: 'row' },
  center: { alignItems: 'center', justifyContent: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  // ---- Screen container ----
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },

  // ---- Auth form area ----
  authScroll: {
    flexGrow: 1,
  },
  authInner: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  // ---- Card / Card-like container ----
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },

  // ---- Text ----
  textH1: {
    fontSize: FontSize.display,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  textH2: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  textH3: {
    fontSize: FontSize.xxl,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  textBody: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  textLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: 6,
  },
  textMuted: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  textLink: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textLink,
  },

  // ---- Input ----
  input: {
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSize.base,
    color: Colors.inputText,
    backgroundColor: Colors.inputBg,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.cardBg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.inputBg,
  },

  // ---- Button ----
  button: {
    borderRadius: BorderRadius.xl,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },

  // ---- Separator ----
  divider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginVertical: Spacing.lg,
  },
});

export const Screen = {
  width,
  height,
};
