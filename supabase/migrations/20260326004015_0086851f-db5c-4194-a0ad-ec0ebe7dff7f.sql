
ALTER TABLE admin_broadcast_campaigns 
ADD COLUMN IF NOT EXISTS next_send_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_sent_at timestamptz DEFAULT NULL;
