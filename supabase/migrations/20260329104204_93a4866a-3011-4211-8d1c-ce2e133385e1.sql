ALTER TABLE public.blocked_users 
ADD COLUMN IF NOT EXISTS block_type text NOT NULL DEFAULT 'permanent',
ADD COLUMN IF NOT EXISTS block_end_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS evidence_notes text,
ADD COLUMN IF NOT EXISTS appeal_message text,
ADD COLUMN IF NOT EXISTS appeal_status text DEFAULT NULL;

ALTER TABLE public.user_warnings
ADD COLUMN IF NOT EXISTS warning_type text NOT NULL DEFAULT 'other',
ADD COLUMN IF NOT EXISTS warning_count integer NOT NULL DEFAULT 1;