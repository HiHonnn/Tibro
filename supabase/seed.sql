-- Public demo data only. Never place real users, credentials, OTPs, or locations here.
INSERT INTO public.system_config (key, value)
VALUES (
  'maintenance',
  '{"enabled": false, "message": "", "estimated_time": ""}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.system_announcements (id, title, message, type, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Chào mừng đến Tibro',
  'Đây là dữ liệu mẫu dùng cho môi trường phát triển.',
  'info',
  true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  message = EXCLUDED.message,
  type = EXCLUDED.type,
  is_active = EXCLUDED.is_active;
