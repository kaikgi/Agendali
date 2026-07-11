-- Root cause of the Supabase "database size exceeding quota" banner: cron.job_run_details
-- (pg_cron's execution history, ~249k rows since March) and net._http_response/http_request_queue
-- (pg_net's HTTP call log, heavily bloated) were never pruned, together accounting for
-- ~492MB of the ~525MB database — 94% system log noise, not application data.
-- One-time cleanup (rows only; VACUUM FULL was run manually to reclaim disk, not repeatable
-- via migration) plus a recurring job so this never re-accumulates.

DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days';
DELETE FROM net._http_response WHERE created < now() - interval '3 days';

SELECT cron.schedule(
  'cleanup-system-logs',
  '0 3 * * *',
  $$
    DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days';
    DELETE FROM net._http_response WHERE created < now() - interval '3 days';
  $$
);
