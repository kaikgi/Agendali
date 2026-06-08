
SELECT cron.schedule(
  'process-broadcast-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://emkcaalgfutbukindxvy.supabase.co/functions/v1/process-broadcast-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVta2NhYWxnZnV0YnVraW5keHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDU2NjIsImV4cCI6MjA4Nzc4MTY2Mn0.zV462shaSHLNm8jIN57aPmvL3pEoAHff9fCCxdKTo5Q"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
