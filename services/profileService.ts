// =========================================================
// services/profileService.ts
// Xem và cập nhật thông tin cá nhân + upload avatar
// =========================================================

import { supabase } from './supabaseConfig';
import { UserProfile } from './friendService';
import { getPublicProfiles } from './profileDirectoryService';
import * as ImageManipulator from 'expo-image-manipulator';
import { readImageAsArrayBuffer } from '../utils/imageFile';

const getMyId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Chưa đăng nhập');
  return session.user.id;
};

// ---- Lấy profile theo userId ----
export const getProfile = async (userId?: string): Promise<UserProfile | null> => {
  const myId = await getMyId();
  const id = userId ?? myId;

  if (id !== myId) {
    const profiles = await getPublicProfiles([id]);
    return profiles[0] ?? null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar, username, gender, birthday, online_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

// ---- Cập nhật thông tin cá nhân ----
export const updateProfile = async (
  updates: Partial<{ name: string; username: string; avatar: string; gender: string; birthday: string }>
): Promise<void> => {
  const myId = await getMyId();
  const { error } = await supabase
    .from('users')
    .update({ ...updates })
    .eq('id', myId);
  if (error) throw error;
};

// ---- Upload avatar lên Supabase Storage ----
export const uploadAvatar = async (uri: string): Promise<string> => {
  const myId = await getMyId();
  const filePath = `${myId}/avatar.jpg`;

  // Chuẩn hoá định dạng và kích thước để ảnh HEIC/PNG từ iPhone cũng upload ổn định.
  const optimizedImage = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );

  // Supabase Storage trên React Native cần dữ liệu nhị phân. FormData không phải
  // là nội dung file hợp lệ cho storage.upload() và có thể tạo request lỗi/rỗng.
  const fileData = await readImageAsArrayBuffer(optimizedImage.uri);

  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, fileData, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });
  if (error) throw error;

  // Lấy public URL
  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`; // cache-bust

  // Cập nhật vào DB
  await updateProfile({ avatar: publicUrl });
  return publicUrl;
};

// ---- Cập nhật trạng thái online ----
export const updateOnlineStatus = async (): Promise<void> => {
  const myId = await getMyId();
  await supabase
    .from('users')
    .update({ online_at: new Date().toISOString() })
    .eq('id', myId);
};

// ---- Lấy ID hiện tại ----
export const getMyUserId = getMyId;
