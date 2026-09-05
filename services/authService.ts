// =========================================================
// services/authService.ts
// Xử lý xác thực người dùng qua Supabase Auth + Tibro Auth API.
//
// Luồng đăng ký:
//   sendOTP → registerUser (backend verifies OTP and creates confirmed Auth user + profile)
//
// Luồng quên mật khẩu:
//   sendOTP → verifyOTP → resetPasswordOnBackend
// =========================================================

import { supabase } from './supabaseConfig';
import { saveUserSession, clearUserSession, saveSessionToken } from '../utils/storage';
import { API_BASE_URL } from './apiConfig';

// Clear only local credentials. This also works when the remote Auth user was
// deleted and the server can no longer revoke the cached refresh token.
export const clearLocalAuthState = async (): Promise<void> => {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    await clearUserSession();
  }
};

// =========================================================
// Hoàn tất đăng ký trên backend sau khi người dùng nhập OTP.
// Service-role key chỉ tồn tại ở backend; Supabase Confirm Email vẫn được bật.
// =========================================================
export const registerUser = async (
  email: string,
  password: string,
  username: string,
  otp: string,
): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, otp }),
      signal: controller.signal,
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Không thể tạo tài khoản. Vui lòng thử lại.');
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Kết nối quá thời gian chờ. Vui lòng thử lại.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

// =========================================================
// Đăng nhập bằng Email & Password
// =========================================================
export const loginUser = async (
  email: string,
  password: string
): Promise<{ id: string; email: string | undefined }> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Đăng nhập thất bại. Không tìm thấy thông tin người dùng.');
  }

  // ---- Đảm bảo user có dữ liệu trong bảng public.users ----
  // (Đề phòng trường hợp admin xoá tay data trong bảng nhưng quên xoá trong mục Authentication)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    await clearLocalAuthState();
    throw new Error('Không thể tải hồ sơ tài khoản. Vui lòng thử đăng nhập lại.');
  }

  if (!profile) {
    await clearLocalAuthState();
    throw new Error('Tài khoản này đã bị xoá dữ liệu trên hệ thống. Vui lòng đăng ký lại.');
  }

  // ---- Đưa session_token vào DB và Local để chặn đăng nhập nhiều thiết bị ----
  const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
  
  const { error: dbError } = await supabase
    .from('users')
    .update({ session_token: sessionToken })
    .eq('id', data.user.id);

  if (dbError) {
    await clearLocalAuthState();
    throw new Error('Không thể khởi tạo phiên đăng nhập. Vui lòng thử lại.');
  }

  await saveUserSession(data.user.id);
  await saveSessionToken(sessionToken);

  return { id: data.user.id, email: data.user.email };
};

// =========================================================
// Đăng xuất
// =========================================================
export const logoutUser = async (): Promise<void> => {
  // Lưu đúng thời điểm hoạt động cuối cùng và tắt chia sẻ vị trí trước khi sign out.
  // Không được lùi online_at để ép trạng thái offline vì giá trị này còn dùng cho
  // nhãn "Hoạt động ... trước" ở danh sách bạn bè.
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    const loggedOutAt = new Date().toISOString();

    await Promise.allSettled([
      supabase.from('users').update({ online_at: loggedOutAt }).eq('id', session.user.id),
      supabase.from('user_locations').update({ is_sharing: false }).eq('user_id', session.user.id)
    ]);
  }

  await clearLocalAuthState();
};

// =========================================================
// Đặt lại mật khẩu qua Tibro Auth API
// Gọi sau khi verifyOTP thành công với type='recovery'
// API xác minh lại OTP trước khi dùng Supabase Admin API để đổi password
// =========================================================
export const resetPasswordOnBackend = async (
  email: string,
  newPassword: string,
  otp: string,
): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${API_BASE_URL}/resetPassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword, otp }),
      signal: controller.signal,
    });
    const text = await res.text();
    const data = (() => { try { return JSON.parse(text); } catch { return {}; } })();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Kết nối quá thời gian chờ. Vui lòng thử lại.');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
