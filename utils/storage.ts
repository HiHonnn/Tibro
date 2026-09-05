// =========================================================
// utils/storage.ts
// Adapter lưu trữ bền vững dùng chung cho Supabase Auth và app settings.
// =========================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ---- Key constants ----
const INTRO_SHOWN_KEY = 'tibro_intro_shown';
const USER_SESSION_KEY = 'tibro_user_session';
const SESSION_TOKEN_KEY = 'tibro_session_token';

// Expo Router prerenders static web routes inside Node.js. AsyncStorage's web
// implementation delegates to window.localStorage, which does not exist there.
// Treat server rendering as an empty, non-persistent store; the browser/native
// client will read the real persistent store after hydration.
const isServerRendering = Platform.OS === 'web' && typeof window === 'undefined';

// =========================================================
// Các hàm tiện ích cơ bản
// =========================================================

/** Lưu một giá trị string */
export const setItem = async (key: string, value: string): Promise<void> => {
  if (isServerRendering) return;
  await AsyncStorage.setItem(key, value);
};

/** Đọc một giá trị string */
export const getItem = async (key: string): Promise<string | null> => {
  if (isServerRendering) return null;
  return AsyncStorage.getItem(key);
};

/** Xoá một giá trị */
export const removeItem = async (key: string): Promise<void> => {
  if (isServerRendering) return;
  await AsyncStorage.removeItem(key);
};

// =========================================================
// Quản lý trạng thái đã xem Intro
// =========================================================

/** Đánh dấu người dùng đã xem màn hình Intro */
export const setIntroShown = async (): Promise<void> => {
  await setItem(INTRO_SHOWN_KEY, 'true');
};

/** Kiểm tra người dùng đã xem Intro chưa */
export const isIntroShown = async (): Promise<boolean> => {
  const value = await getItem(INTRO_SHOWN_KEY);
  return value === 'true';
};

// =========================================================
// Quản lý Session đăng nhập
// =========================================================

/** Lưu UID người dùng sau khi đăng nhập thành công */
export const saveUserSession = async (uid: string): Promise<void> => {
  await setItem(USER_SESSION_KEY, uid);
};

/** Lấy UID người dùng từ session đã lưu */
export const getUserSession = async (): Promise<string | null> => {
  return await getItem(USER_SESSION_KEY);
};

/** Xoá session khi người dùng đăng xuất */
export const clearUserSession = async (): Promise<void> => {
  await removeItem(USER_SESSION_KEY);
  await removeItem(SESSION_TOKEN_KEY);
};

// =========================================================
// Quản lý Đăng nhập 1 thiết bị (Single Device)
// =========================================================

export const saveSessionToken = async (token: string): Promise<void> => {
  await setItem(SESSION_TOKEN_KEY, token);
};

export const getSessionToken = async (): Promise<string | null> => {
  return await getItem(SESSION_TOKEN_KEY);
};
