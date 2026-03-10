SELECT cron.schedule(
  'send-appointment-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://emkcaalgfutbukindxvy.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVta2NhYWxnZnV0YnVraW5keHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDU2NjIsImV4cCI6MjA4Nzc4MTY2Mn0.zV462shaSHLNm8jIN57aPmvL3pEoAHff9fCCxdKTo5Q"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);