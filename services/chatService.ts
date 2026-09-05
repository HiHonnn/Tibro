// =========================================================
// services/chatService.ts
// Chat 1-1: conversations + messages với real-time
// =========================================================

import { supabase } from './supabaseConfig';
import { getPublicProfiles } from './profileDirectoryService';
import * as ImageManipulator from 'expo-image-manipulator';
import { readImageAsArrayBuffer } from '../utils/imageFile';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read?: boolean;
};

export type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  unread_count?: number;
  other_user?: {
    id: string;
    name: string;
    avatar: string;
    online_at?: string;
  };
};

const getMyId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Chưa đăng nhập');
  return session.user.id;
};

// ---- Tạo hoặc lấy conversation với 1 người ----
export const getOrCreateConversation = async (otherUserId: string): Promise<string> => {
  const myId = await getMyId();
  const [u1, u2] = myId < otherUserId ? [myId, otherUserId] : [otherUserId, myId];

  // Kiểm tra đã có conversation chưa
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user1_id', u1)
    .eq('user2_id', u2)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) return existing.id;

  // Tạo mới
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user1_id: u1, user2_id: u2 })
    .select('id')
    .single();
  if (error?.code === '23505') {
    const { data: raced, error: racedError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .single();
    if (racedError) throw racedError;
    return raced.id;
  }
  if (error) throw error;
  return data.id;
};

// ---- Danh sách tất cả conversations của user ----
export const getConversations = async (): Promise<Conversation[]> => {
  const myId = await getMyId();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user1_id, user2_id, last_message, last_message_at, created_at, user1_cleared_at, user2_cleared_at')
    .or(`user1_id.eq.${myId},user2_id.eq.${myId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;

  const convs = data ?? [];
  if (convs.length === 0) return [];

  const otherUserIds = convs.map(c => c.user1_id === myId ? c.user2_id : c.user1_id);
  const users = await getPublicProfiles(otherUserIds);
  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  // Count unread messages cho từng conversation
  const { data: unreadMsgs, error: unreadError } = await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', convs.map(c => c.id))
    .neq('sender_id', myId)
    .eq('is_read', false);
  if (unreadError) throw unreadError;

  const unreadCountMap: Record<string, number> = {};
  if (unreadMsgs) {
    unreadMsgs.forEach(msg => {
      unreadCountMap[msg.conversation_id] = (unreadCountMap[msg.conversation_id] || 0) + 1;
    });
  }

  return convs.map(c => {
    const otherId = c.user1_id === myId ? c.user2_id : c.user1_id;
    const clearedAt = c.user1_id === myId ? c.user1_cleared_at : c.user2_cleared_at;

    // Nếu thời điểm xóa chat SAU thời điểm tin nhắn cuối cùng -> ẩn tin nhắn cuối
    let displayLastMessage = c.last_message;
    if (clearedAt && c.last_message_at && new Date(clearedAt) >= new Date(c.last_message_at)) {
      displayLastMessage = ''; // Hoặc có thể để null
    }

    return {
      ...c,
      last_message: displayLastMessage,
      other_user: userMap.get(otherId),
      unread_count: unreadCountMap[c.id] || 0
    };
  });
};

// ---- Lấy tin nhắn của 1 conversation ----
export const getMessages = async (conversationId: string): Promise<Message[]> => {
  const myId = await getMyId();

  // 1. Lấy thông tin conversation để biết cleared_at
  const { data: conv, error: conversationError } = await supabase
    .from('conversations')
    .select('user1_id, user2_id, user1_cleared_at, user2_cleared_at')
    .eq('id', conversationId)
    .single();
  if (conversationError) throw conversationError;

  let clearedAt = null;
  if (conv) {
    clearedAt = conv.user1_id === myId ? conv.user1_cleared_at : conv.user2_cleared_at;
  }

  // 2. Fetch tin nhắn
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  // 3. Nếu có clearedAt, chỉ lấy tin nhắn mới hơn thời điểm đó
  if (clearedAt) {
    query = query.gt('created_at', clearedAt);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

// ---- Xóa lịch sử chat (Xóa 1 chiều) ----
export const clearChatHistory = async (conversationId: string): Promise<void> => {
  const myId = await getMyId();
  const { data: conv, error: conversationError } = await supabase
    .from('conversations')
    .select('user1_id, user2_id')
    .eq('id', conversationId)
    .single();

  if (conversationError) throw conversationError;

  if (!conv) throw new Error('Không tìm thấy cuộc trò chuyện');

  const field = conv.user1_id === myId ? 'user1_cleared_at' : 'user2_cleared_at';
  const { error } = await supabase
    .from('conversations')
    .update({ [field]: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) throw error;
};

// ---- Gửi tin nhắn (+ cộng điểm thân mật +1đ) ----
export const sendMessage = async (
  conversationId: string,
  content: string,
  otherUserId?: string,  // cần để cộng điểm thân mật
): Promise<Message> => {
  const myId = await getMyId();
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: myId, content })
    .select()
    .single();
  if (error) throw error;

  return data;
};

// ---- Subscribe tin nhắn mới (real-time) ----
export const subscribeToMessages = (
  conversationId: string,
  onNewMessage: (msg: Message) => void
) => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onNewMessage(payload.new as Message)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};

// ---- Đánh dấu tất cả tin nhắn trong 1 cuộc trò chuyện thành đã đọc ----
export const markMessagesAsRead = async (conversationId: string): Promise<void> => {
  const myId = await getMyId();
  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', myId)
    .eq('is_read', false);
  
  if (error) throw error;
};

// ---- Upload ảnh chat ----
export const uploadChatImage = async (uri: string): Promise<string> => {
  const myId = await getMyId();
  const optimizedImage = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
  );
  const fileData = await readImageAsArrayBuffer(optimizedImage.uri);
  const fileName = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`;
  const filePath = `${myId}/${fileName}`;

  const { error } = await supabase.storage
    .from('chat-images')
    .upload(filePath, fileData, {
      upsert: false,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });
  if (error) throw error;

  const { data } = supabase.storage.from('chat-images').getPublicUrl(filePath);
  return data.publicUrl;
};

// ---- Cập nhật biệt danh ----
export const updateNickname = async (conversationId: string, nickname: string): Promise<void> => {
  const myId = await getMyId();
  const { data: conv, error: conversationError } = await supabase
    .from('conversations')
    .select('user1_id, user2_id')
    .eq('id', conversationId)
    .single();

  if (conversationError) throw conversationError;
  if (!conv) throw new Error('Không tìm thấy cuộc trò chuyện');

  const field = conv.user1_id === myId ? 'user1_nickname' : 'user2_nickname';
  const { error } = await supabase
    .from('conversations')
    .update({ [field]: nickname })
    .eq('id', conversationId);
  
  if (error) throw error;
};

// ---- Bật/Tắt thông báo ----
export const toggleMute = async (conversationId: string, isMuted: boolean): Promise<void> => {
  const myId = await getMyId();
  const { data: conv, error: conversationError } = await supabase
    .from('conversations')
    .select('user1_id, user2_id')
    .eq('id', conversationId)
    .single();

  if (conversationError) throw conversationError;
  if (!conv) throw new Error('Không tìm thấy cuộc trò chuyện');

  const field = conv.user1_id === myId ? 'user1_mute' : 'user2_mute';
  const { error } = await supabase
    .from('conversations')
    .update({ [field]: isMuted })
    .eq('id', conversationId);
  
  if (error) throw error;
};

// ---- Lấy các ảnh đã gửi trong cuộc trò chuyện ----
export const getSharedPhotos = async (conversationId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .like('content', '[IMAGE:%')
    .order('created_at', { ascending: false });
  
  if (error) throw error;

  const regex = /^\[IMAGE:(.+?)\]/;
  const photos: string[] = [];
  data.forEach(msg => {
    const match = msg.content.match(regex);
    if (match) photos.push(match[1]);
  });
  return photos;
};
