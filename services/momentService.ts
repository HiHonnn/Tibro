// =========================================================
// services/momentService.ts
// Xử lý upload ảnh Moment và các logic liên quan
// =========================================================

import { supabase } from './supabaseConfig';
import * as ImageManipulator from 'expo-image-manipulator';
import { getPublicProfiles } from './profileDirectoryService';
import { readImageAsArrayBuffer } from '../utils/imageFile';

export type MomentData = {
  id: string;
  user_id: string;
  image_url: string;
  latitude: number;
  longitude: number;
  caption?: string;
  created_at: string;
  user?: {
    id?: string;
    name: string;
    avatar: string;
  };
};

// ---- Lấy ID người dùng hiện tại ----
const getMyId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Chưa đăng nhập');
  return session.user.id;
};

// ---- Nén ảnh trước khi upload ----
const compressImage = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }], // Resize width, keep aspect ratio
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

// ---- Đăng Moment mới ----
export const postMoment = async (
  imageUri: string,
  latitude: number,
  longitude: number,
  caption?: string
): Promise<MomentData> => {
  const myId = await getMyId();

  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    throw new Error('Không lấy được vị trí hợp lệ');
  }
  if ((caption?.trim().length ?? 0) > 50) throw new Error('Chú thích tối đa 50 ký tự');
  
  // 1. Nén ảnh
  const compressedUri = await compressImage(imageUri);

  // Supabase Storage trên React Native không upload ổn định khi nhận
  // FormData. Chuyển file:// URI thành ArrayBuffer trước khi gửi.
  const fileData = await readImageAsArrayBuffer(compressedUri);

  // 2. Tạo tên file không trùng trong thư mục riêng của user
  const timestamp = Date.now();
  const suffix = Math.random().toString(36).slice(2, 10);
  const filePath = `${myId}/moment_${timestamp}_${suffix}.jpg`;

  // 3. Upload ảnh lên bucket 'moments'
  const { error: uploadError } = await supabase.storage
    .from('moments')
    .upload(filePath, fileData, {
      upsert: false,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });
    
  if (uploadError) throw new Error(`Lỗi tải ảnh lên: ${uploadError.message}`);

  // Lấy Public URL
  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl;

  // 4. Lưu vào bảng moments
  const { data, error: dbError } = await supabase
    .from('moments')
    .insert({
      user_id: myId,
      image_url: publicUrl,
      latitude,
      longitude,
      caption: caption?.trim() || null,
    })
    .select()
    .single();

  if (dbError) {
    // Không để lại file rác nếu insert database thất bại.
    await supabase.storage.from('moments').remove([filePath]).catch(() => undefined);
    throw new Error(`Lỗi lưu dữ liệu: ${dbError.message}`);
  }

  return data;
};

// ---- Lấy danh sách Moment hiển thị trên Map (24h qua) ----
export const getMapMoments = async (friendIds: string[]): Promise<MomentData[]> => {
  const myId = await getMyId();
  const targetIds = [...friendIds, myId];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('moments')
    .select('*')
    .in('user_id', targetIds)
    .gte('created_at', since);

  if (error) throw error;

  const moments = data ?? [];
  if (moments.length === 0) return [];

  // Lấy thông tin user (thủ công thay vì join để tránh lỗi schema config)
  const uids = [...new Set(moments.map(m => m.user_id))];
  const users = await getPublicProfiles(uids);
    
  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  return moments.map(row => {
    const u = userMap.get(row.user_id);
    return {
      ...row,
      user: u ? { id: u.id, name: u.name, avatar: u.avatar } : undefined,
    };
  });
};

// ---- Lấy Moments của một người theo ngày (cho Timeline) ----
export const getMomentsByDate = async (
  userId: string,
  dateStr: string // format: YYYY-MM-DD
): Promise<MomentData[]> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('Ngày không hợp lệ');
  const startOfDay = new Date(`${dateStr}T00:00:00+07:00`);
  if (Number.isNaN(startOfDay.getTime())) throw new Error('Ngày không hợp lệ');
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('moments')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', endOfDay.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
};
