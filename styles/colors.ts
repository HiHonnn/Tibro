// =========================================================
// styles/colors.ts
// Hệ thống màu sắc — Dark Theme (Deep Indigo)
// Lấy cảm hứng từ Splash Screen gradient
// =========================================================

export const Colors = {
  // ---- Primary Brand Colors (Indigo nổi bật trên nền tối) ----
  primary: '#6366F1',          // Indigo sáng - nổi bật trên dark
  primaryDark: '#4F46E5',      // Indigo đậm
  primaryLight: 'rgba(99, 102, 241, 0.15)', // Indigo mờ cho backgrounds

  // ---- Secondary & Accent ----
  accent: '#EC4899',           // Hồng hot pink
  accentLight: 'rgba(236, 72, 153, 0.15)',

  // ---- Register Green ----
  success: '#34D399',
  successDark: '#10B981',
  successLight: 'rgba(52, 211, 153, 0.15)',

  // ---- Forgot Orange ----
  warning: '#FBBF24',
  warningDark: '#F59E0B',
  warningLight: 'rgba(251, 191, 36, 0.15)',

  // ---- Error Red ----
  error: '#F87171',
  errorLight: 'rgba(248, 113, 113, 0.15)',

  // ---- Neutrals (Dark palette) ----
  white: '#F1F5F9',           // "White" trên dark = xám rất nhạt
  black: '#0B0F1A',           // Nền tối nhất

  gray50: '#111827',          // Nhẹ hơn black 1 chút
  gray100: '#1E2540',         // Viền, separator
  gray200: '#2A3050',         // Border input
  gray300: '#3B4468',         // 
  gray400: '#6B7A99',         // Icon mờ
  gray500: '#8896B3',         // Text phụ mờ
  gray600: '#A0AEC0',         // 
  gray700: '#CBD5E1',         // Label
  gray800: '#E2E8F0',         // Text sáng
  gray900: '#F1F5F9',         // Text trắng nhất

  // ---- Background Gradients ----
  gradientStart: '#0B0F1A',
  gradientEnd: '#111827',

  // ---- Splash Background ----
  splashBg: '#0B0F1A',

  // ---- Input ----
  inputBorder: '#2A3050',
  inputBg: '#151929',
  inputFocusBorder: '#6366F1',
  inputText: '#E2E8F0',
  placeholder: '#6B7A99',

  // ---- Cards ----
  cardBg: '#1A1F36',
  cardShadow: 'rgba(0, 0, 0, 0.3)',

  // ---- Text ----
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#6B7A99',
  textLink: '#818CF8',
};

// Theme màu cho từng màn hình (tông tối)
export const ScreenTheme = {
  login: {
    color: Colors.primary,
    colorDark: Colors.primaryDark,
    colorLight: Colors.primaryLight,
  },
  register: {
    color: Colors.success,
    colorDark: Colors.successDark,
    colorLight: Colors.successLight,
  },
  forgot: {
    color: Colors.warning,
    colorDark: Colors.warningDark,
    colorLight: Colors.warningLight,
  },
};
