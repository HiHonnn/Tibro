// =========================================================
// services/friendService.ts
// Quản lý kết bạn: gửi lời mời, chấp nhận, từ chối, danh sách
// =========================================================
import { supabase } from './supabaseConfig';
import { DeviceEventEmitter } from 'react-native';
import { getPublicProfiles, searchPublicProfiles } from './profileDirectoryService';

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  username?: string;
  gender?: string;
  birthday?: string;
  online_at?: string;
};

export type FriendRequest = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  other_user?: UserProfile;
};

// ---- Helper: lấy ID người dùng hiện tại ----
const getMyId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Chưa đăng nhập');
  return session.user.id;
};

// ---- Tìm kiếm người dùng theo tên hoặc username ----
export const searchUsers = async (query: string): Promise<UserProfile[]> => {
  if (!query.trim()) return [];
  const myId = await getMyId();
  const profiles = await searchPublicProfiles(query, 20);
  return profiles.filter(profile => profile.id !== myId);
};

// ---- Gửi lời mời kết bạn ----
export const sendFriendRequest = async (toUserId: string): Promise<void> => {
  const myId = await getMyId();
  const { error } = await supabase
    .from('friends')
    .insert({ requester_id: myId, receiver_id: toUserId, status: 'pending' });
  if (error) throw error;
};

// ---- Chấp nhận / từ chối lời mời ----
export const respondToRequest = async (requestId: string, accept: boolean): Promise<void> => {
  if (accept) {
    const { error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    if (error) throw error;
    DeviceEventEmitter.emit('friends_badge_update');
  } else {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', requestId);
    if (error) throw error;
    DeviceEventEmitter.emit('friends_badge_update');
  }
};

// ---- Hủy kết bạn ----
export const unfriend = async (friendId: string): Promise<void> => {
  const myId = await getMyId();
  const { error } = await supabase
    .from('friends')
    .delete()
    .or(`and(requester_id.eq.${myId},receiver_id.eq.${friendId}),and(requester_id.eq.${friendId},receiver_id.eq.${myId})`);
  if (error) throw error;
  DeviceEventEmitter.emit('friends_badge_update');
};

// ---- Danh sách bạn bè đã chấp nhận ----
export const getFriends = async (): Promise<UserProfile[]> => {
  const myId = await getMyId();
  const { data, error } = await supabase
    .from('friends')
    .select('requester_id, receiver_id')
    .or(`requester_id.eq.${myId},receiver_id.eq.${myId}`)
    .eq('status', 'accepted');
  if (error) throw error;

  const friendIds = (data ?? []).map(f =>
    f.requester_id === myId ? f.receiver_id : f.requester_id
  );
  if (friendIds.length === 0) return [];

  return getPublicProfiles(friendIds);
};

// ---- Lời mời chờ xử lý (nhận được) ----
export const getPendingRequests = async (): Promise<FriendRequest[]> => {
  const myId = await getMyId();
  const { data, error } = await supabase
    .from('friends')
    .select('id, requester_id, receiver_id, status, created_at')
    .eq('receiver_id', myId)
    .eq('status', 'pending');
  if (error) throw error;

  const requests = data ?? [];
  if (requests.length === 0) return [];

  const requesterIds = requests.map(r => r.requester_id);
  const users = await getPublicProfiles(requesterIds);

  const userMap = new Map((users ?? []).map(u => [u.id, u]));
  return requests.map(r => ({ ...r, other_user: userMap.get(r.requester_id) }));
};

// ---- Lời mời đã gửi (đang chờ người khác chấp nhận) ----
export const getSentRequests = async (): Promise<FriendRequest[]> => {
  const myId = await getMyId();
  const { data, error } = await supabase
    .from('friends')
    .select('id, requester_id, receiver_id, status, created_at')
    .eq('requester_id', myId)
    .eq('status', 'pending');
  if (error) throw error;

  const requests = data ?? [];
  if (requests.length === 0) return [];

  const receiverIds = requests.map(r => r.receiver_id);
  const users = await getPublicProfiles(receiverIds);

  const userMap = new Map((users ?? []).map(u => [u.id, u]));
  return requests.map(r => ({ ...r, other_user: userMap.get(r.receiver_id) }));
};
// ---- Kiểm tra trạng thái bạn bè với 1 user ----
export const getFriendshipStatus = async (
  otherUserId: string
): Promise<{ status: string | null; requestId: string | null }> => {
  const myId = await getMyId();
  const { data, error } = await supabase
    .from('friends')
    .select('id, status')
    .or(
      `and(requester_id.eq.${myId},receiver_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},receiver_id.eq.${myId})`
    )
    .maybeSingle();
  if (error) throw error;
  return { status: data?.status ?? null, requestId: data?.id ?? null };
};

// ---- Lấy ID user hiện tại (export) ----
export const getCurrentUserId = getMyId;

// ---- Lấy IDs bạn bè (dùng cho map) ----
export const getFriendIds = async (): Promise<string[]> => {
  const myId = await getMyId();
  const { data, error } = await supabase
    .from('friends')
    .select('requester_id, receiver_id')
    .or(`requester_id.eq.${myId},receiver_id.eq.${myId}`)
    .eq('status', 'accepted');
  if (error) throw error;
  return (data ?? []).map(f => f.requester_id === myId ? f.receiver_id : f.requester_id);
};

// ---- Thu hồi lời mời kết bạn đã gửi ----
export const cancelFriendRequest = async (toUserId: string): Promise<void> => {
  const myId = await getMyId();
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('requester_id', myId)
    .eq('receiver_id', toUserId)
    .eq('status', 'pending');
  if (error) throw error;
  DeviceEventEmitter.emit('friends_badge_update');
};
