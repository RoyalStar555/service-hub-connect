ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS setting_text text;
ALTER TABLE public.app_settings ALTER COLUMN setting_value SET DEFAULT 0;
INSERT INTO public.app_settings (setting_key, setting_value, setting_text)
SELECT 'admin_master_key', 0, 'ADMIN-Rahul'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE setting_key = 'admin_master_key');