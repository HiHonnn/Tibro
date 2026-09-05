// =========================================================
// services/locationService.ts
// Chia sẻ và lấy vị trí real-time qua Supabase
// =========================================================

import { supabase } from './supabaseConfig';
import { getPublicProfiles } from './profileDirectoryService';

export type UserLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  is_sharing: boolean;
  updated_at: string;
  user?: {
    name: string;
    avatar: string;
  };
};

const getMyId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Chưa đăng nhập');
  return session.user.id;
};

// ---- Cập nhật vị trí của mình ----
export const updateMyLocation = async (
  latitude: number,
  longitude: number
): Promise<void> => {
  const myId = await getMyId();
  const { error } = await supabase
    .from('user_locations')
    .upsert({
      user_id: myId,
      latitude,
      longitude,
      is_sharing: true,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
};

// ---- Bật / Tắt chia sẻ vị trí ----
export const toggleLocationSharing = async (isSharing: boolean): Promise<void> => {
  const myId = await getMyId();
  const { error } = await supabase
    .from('user_locations')
    .upsert({ user_id: myId, is_sharing: isSharing, updated_at: new Date().toISOString() });
  if (error) throw error;
};

// ---- Lấy vị trí của danh sách bạn bè ----
export const getFriendsLocations = async (
  friendIds: string[]
): Promise<UserLocation[]> => {
  if (friendIds.length === 0) return [];
  
  // Chỉ lấy vị trí được cập nhật trong 5 phút qua để tránh "bóng ma" khi bạn bè tắt app đột ngột
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('user_locations')
    .select('user_id, latitude, longitude, is_sharing, updated_at')
    .in('user_id', friendIds)
    .eq('is_sharing', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('updated_at', fiveMinsAgo);
  if (error) throw error;

  // Lấy thêm thông tin user (tên + avatar)
  const userIds = (data ?? []).map(l => l.user_id);
  const users = await getPublicProfiles(userIds);
  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  return (data ?? []).filter(l =>
    Number.isFinite(l.latitude) && Number.isFinite(l.longitude)
  ).map(l => {
    const u = userMap.get(l.user_id);
    return {
      ...l,
      user: u ? { name: u.name, avatar: u.avatar } : undefined,
    };
  });
};

// ---- Lấy vị trí của mình ----
export const getMyLocation = async (): Promise<UserLocation | null> => {
  const myId = await getMyId();
  const { data, error } = await supabase
    .from('user_locations')
    .select('*')
    .eq('user_id', myId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

// ---- Kiểm tra trạng thái chia sẻ hiện tại ----
export const isSharingEnabled = async (): Promise<boolean | null> => {
  const loc = await getMyLocation();
  return loc?.is_sharing ?? null;
};
