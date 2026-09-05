// =========================================================
// services/reportService.ts
// Gửi báo cáo người dùng vi phạm
// =========================================================

import { supabase } from './supabaseConfig';

/**
 * Gửi báo cáo (report) về một người dùng vi phạm.
 * @param reportedUserId - ID người bị báo cáo
 * @param reason - Lý do báo cáo (bắt buộc)
 * @param description - Mô tả chi tiết (tùy chọn)
 */
export const sendReport = async (
  reportedUserId: string,
  reason: string,
  description?: string
): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Chưa đăng nhập');
  if (reportedUserId === session.user.id) throw new Error('Bạn không thể tự báo cáo chính mình');
  if (!reason.trim() || reason.trim().length > 100) throw new Error('Lý do báo cáo không hợp lệ');
  if ((description?.trim().length ?? 0) > 500) throw new Error('Mô tả tối đa 500 ký tự');
  
  const { error } = await supabase.from('reports').insert({
    reporter_id: session.user.id,
    reported_user_id: reportedUserId,
    reason: reason.trim(),
    description: description?.trim() || null,
  });

  if (error) throw error;
};

/**
 * Kiểm tra tài khoản hiện tại có bị ban không.
 */
export const checkBanned = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return false;

  const { data } = await supabase
    .from('users')
    .select('is_banned')
    .eq('id', session.user.id)
    .maybeSingle();

  return data?.is_banned === true;
};
