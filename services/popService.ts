import { supabase } from './supabaseConfig';

export interface PopData {
  id: string;
  sender_id: string;
  receiver_id: string;
  emoji: string;
  count: number;
  created_at: string;
  is_seen: boolean;
}

// Kiểm tra response có phải là lỗi HTML không (bảng chưa tồn tại, Cloudflare error...)
const isHtmlError = (error: any): boolean => {
  if (!error) return false;
  const msg = error?.message || '';
  return typeof msg === 'string' && msg.trim().startsWith('<!DOCTYPE');
};

// Gửi pop
export const sendPops = async (receiverId: string, emoji: string, count: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Chưa đăng nhập');
    const myId = session.user.id;
    if (!emoji || emoji.length > 16 || count < 1 || count > 100) {
      throw new Error('Dữ liệu pop không hợp lệ');
    }

    const { error } = await supabase
      .from('map_pops')
      .insert({
        sender_id: myId,
        receiver_id: receiverId,
        emoji,
        count
      });

    if (error) {
      if (isHtmlError(error)) {
        throw new Error('Dịch vụ pop chưa sẵn sàng.');
      }
      throw error;
    }
};

// Lấy danh sách pop chưa đọc
export const getUnseenPops = async (): Promise<PopData[]> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const myId = session.user.id;

    const { data, error } = await supabase
      .from('map_pops')
      .select('*')
      .eq('receiver_id', myId)
      .eq('is_seen', false);

    if (error) {
      const errMsg = error?.message || '';
      const errCode = error?.code || '';
      // Bảng chưa tồn tại / HTML error → bỏ qua
      if (isHtmlError(error) || errCode === '42P01' || errMsg.includes('relation') || errMsg.includes('does not exist')) {
        throw new Error('Dịch vụ pop chưa sẵn sàng.');
      }
      throw error;
    }
    return data || [];
  } catch (e: any) {
    // Bỏ qua lỗi network / bảng chưa có
    throw e;
  }
};

// Đánh dấu đã đọc
export const markPopsAsSeen = async (popIds: string[]) => {
  if (popIds.length === 0) return;
  try {
    const { error } = await supabase
      .from('map_pops')
      .update({ is_seen: true })
      .in('id', popIds);

    if (error) {
      if (isHtmlError(error) || error.code === '42P01') {
        throw new Error('Dịch vụ pop chưa sẵn sàng.');
      }
      throw error;
    }
  } catch (e) { throw e; }
};
