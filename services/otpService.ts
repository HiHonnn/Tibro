// =========================================================
// services/otpService.ts
// Gửi và xác minh OTP qua Tibro Auth API.
// - sendOTP  → POST /sendOtp  → Gửi Gmail (Nodemailer)
// - verifyOTP → POST /verifyOtp → Kiểm tra Supabase DB
// =========================================================

import { API_BASE_URL } from './apiConfig';

// Timeout 60 giây — tránh xoay mãi khi server Render.com free đang ngủ (Cold Start mất khoảng 50s)
const FETCH_TIMEOUT_MS = 60000;

/** Helper: fetch với timeout và kiểm tra JSON */
async function fetchWithTimeout(url: string, options: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    const text = await res.text();

    // Kiểm tra xem server có trả về JSON không
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
      throw new Error('Server đang khởi động, vui lòng thử lại sau vài giây.');
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Kết nối quá thời gian chờ (60s). Server đang khởi động, vui lòng thử lại.');
    }
    throw err;
  }
}

// =========================================================
// Gửi OTP — gọi backend
// =========================================================
export const sendOTP = async (
  email: string,
  type: 'signup' | 'recovery' = 'signup'
): Promise<void> => {
  const { ok, data } = await fetchWithTimeout(`${API_BASE_URL}/sendOtp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type }),
  });

  if (!ok || data.error) {
    throw new Error(data.error || 'Không thể gửi OTP. Vui lòng thử lại.');
  }
};

// =========================================================
// Xác minh OTP — gọi backend
// =========================================================
export const verifyOTP = async (
  email: string,
  otp: string,
  type: 'signup' | 'recovery' = 'signup'
): Promise<boolean> => {
  const { ok, data } = await fetchWithTimeout(`${API_BASE_URL}/verifyOtp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, type }),
  });

  if (!ok) {
    throw new Error(data.error || 'Không thể xác minh OTP. Vui lòng thử lại.');
  }

  if (!data.verified) {
    return false;
  }
  return true;
};
