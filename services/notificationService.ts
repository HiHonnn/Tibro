// =========================================================
// services/notificationService.ts
// Hệ thống thông báo: react Moment, Bump điểm thân mật, v.v.
// =========================================================
import { supabase } from './supabaseConfig';
import { getPublicProfiles } from './profileDirectoryService';

export type NotificationType =
  | 'moment_reaction'   // Ai đó react moment của bạn
  | 'intimacy_bump'     // Cộng điểm từ Bump
  | 'intimacy_chat'     // Cộng điểm từ chat
  | 'emoji_pop';        // Ai đó bắn emoji vào bạn

export type AppNotification = {
  id: string;
  user_id: string;       // người nhận
  actor_id: string;      // người gây ra hành động
  type: NotificationType;
  data: Record<string, any>; // dữ liệu tuỳ loại (emoji, moment_id, points, ...)
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    name: string;
    avatar?: string;
  };
};

const getMyId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Chưa đăng nhập');
  return session.user.id;
};

// ---- Tạo thông báo mới ----
export const createNotification = async (
  toUserId: string,
  type: NotificationType,
  data: Record<string, any>,
): Promise<void> => {
  const myId = await getMyId();
  if (myId === toUserId) return; // Không tự thông báo cho chính mình

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: toUserId,
      actor_id: myId,
      type,
      data,
      is_read: false,
    });

  if (error) throw error;
};

// ---- Lấy danh sách thông báo của người dùng hiện tại ----
export const getNotifications = async (limit = 30): Promise<AppNotification[]> => {
  const myId = await getMyId();

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', myId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const notifications = data ?? [];
  if (notifications.length === 0) return [];

  // Gắn thêm thông tin actor
  const actorIds = [...new Set(notifications.map(n => n.actor_id))];
  const users = await getPublicProfiles(actorIds);

  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  return notifications.map(n => ({
    ...n,
    actor: userMap.get(n.actor_id),
  }));
};

// ---- Đếm thông báo chưa đọc ----
export const getUnreadCount = async (): Promise<number> => {
  const myId = await getMyId();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', myId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
};

// ---- Đánh dấu 1 thông báo đã đọc ----
export const markNotificationRead = async (notifId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notifId);
  if (error) throw error;
};

// ---- Đánh dấu tất cả đã đọc ----
export const markAllNotificationsRead = async (): Promise<void> => {
  const myId = await getMyId();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', myId)
    .eq('is_read', false);
  if (error) throw error;
};

// ---- Lắng nghe thông báo mới (Realtime) ----
let notificationSubscriptionSequence = 0;
export const subscribeToNotifications = (
  onNew: (notif: AppNotification) => void
) => {
  let cancelled = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  const sequence = ++notificationSubscriptionSequence;

  // Lấy myId trước rồi subscribe
  supabase.auth.getSession().then(({ data }) => {
    const myId = data.session?.user?.id ?? null;
    if (!myId) return;

    const nextChannel = supabase
      .channel(`notifications-realtime-${myId}-${sequence}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${myId}`,
        },
        (payload) => {
          onNew(payload.new as AppNotification);
        }
      )
      .subscribe();

    if (cancelled) {
      void supabase.removeChannel(nextChannel);
    } else {
      channel = nextChannel;
    }
  });

  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
};
