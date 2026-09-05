// =========================================================
// services/announcementService.ts
// Lấy thông báo hệ thống từ admin
// =========================================================

import { supabase } from './supabaseConfig';

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'update' | 'event';
  created_at: string;
}

/**
 * Lấy danh sách thông báo hệ thống đang active.
 * Sắp xếp mới nhất lên đầu.
 */
export const getAnnouncements = async (): Promise<SystemAnnouncement[]> => {
  const { data, error } = await supabase
    .from('system_announcements')
    .select('id, title, message, type, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
};
