-- ============================================================
-- SQL Update: Thêm tính năng xóa lịch sử chat 1 chiều
-- Chạy trong Supabase SQL Editor
-- ============================================================

-- Thêm 2 cột để lưu thời điểm mỗi người dùng xóa lịch sử chat
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS user1_cleared_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS user2_cleared_at TIMESTAMPTZ;
