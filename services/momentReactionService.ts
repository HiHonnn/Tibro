// =========================================================
// services/momentReactionService.ts
// Lưu + lắng nghe reaction cảm xúc trên Moment (realtime)
// =========================================================

import { supabase } from './supabaseConfig';
import { getPublicProfiles } from './profileDirectoryService';

export interface MomentReaction {
  id: string;
  moment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionWithUser extends MomentReaction {
  user: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

// ---- Lấy tất cả reactions kèm thông tin user (2 query độc lập, không cần FK join) ----
export const fetchReactionsWithUsers = async (momentId: string): Promise<ReactionWithUser[]> => {
  // Bước 1: Lấy danh sách reactions
  const { data: reactions, error: reactionsError } = await supabase
    .from('moment_reactions')
    .select('id, moment_id, user_id, emoji, created_at')
    .eq('moment_id', momentId)
    .order('created_at', { ascending: false });

  if (reactionsError) throw reactionsError;
  if (!reactions || reactions.length === 0) return [];

  // Bước 2: Lấy thông tin user cho các user_id trong reactions
  const userIds = [...new Set(reactions.map(r => r.user_id))];
  const users = await getPublicProfiles(userIds);

  // Gộp lại
  const userMap = new Map(users.map(u => [u.id, u]));
  return reactions.map(r => ({
    ...r,
    user: userMap.get(r.user_id) || { id: r.user_id, name: 'Người dùng', avatar: null },
  })) as ReactionWithUser[];
};

// ---- Lấy ID người dùng hiện tại ----
const getMyId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Chưa đăng nhập');
  return session.user.id;
};

// ---- Gửi reaction (+5 điểm thân mật với chủ moment) ----
export const sendReaction = async (
  momentId: string,
  emoji: string,
): Promise<void> => {
  const myId = await getMyId();

  const { error } = await supabase
    .from('moment_reactions')
    .insert({
      moment_id: momentId,
      user_id: myId,
      emoji,
    });

  if (error) throw error;
};

// ---- Lắng nghe reaction realtime cho 1 moment ----
export const subscribeToReactions = (
  momentId: string,
  onNewReaction: (reaction: MomentReaction) => void
) => {
  const channel = supabase
    .channel(`moment-reactions-${momentId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'moment_reactions',
        filter: `moment_id=eq.${momentId}`,
      },
      (payload) => {
        onNewReaction(payload.new as MomentReaction);
      }
    )
    .subscribe();

  // Trả về hàm unsubscribe
  return () => {
    supabase.removeChannel(channel);
  };
};
